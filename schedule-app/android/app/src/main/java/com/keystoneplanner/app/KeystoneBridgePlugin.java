package com.keystoneplanner.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.provider.ContactsContract;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PermissionState;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Small bridge between the web app and Android: it hands the home screen
 * widget its data, and tells the web app when something was shared into
 * Keystone or the widget was tapped. Events are retained until the web side
 * starts listening, so a cold start from the share sheet is not lost.
 */
@CapacitorPlugin(
    name = "KeystoneBridge",
    // Read access only. (The community contacts plugin asks for write access as
    // well, which Keystone has no use for.)
    permissions = {
        @Permission(strings = { Manifest.permission.READ_CONTACTS }, alias = "contacts"),
        @Permission(strings = { Manifest.permission.READ_CALENDAR }, alias = "calendar")
    }
)
public class KeystoneBridgePlugin extends Plugin {

    @PluginMethod
    public void updateWidget(PluginCall call) {
        String json = call.getString("json");
        Context context = getContext();
        if (json != null) {
            KeystoneWidgetProvider.save(context, json);
        }
        KeystoneWidgetProvider.refreshAll(context);
        call.resolve();
    }

    /** Text shared into Keystone from another app. */
    public void deliverShare(String text, String subject) {
        JSObject data = new JSObject();
        data.put("text", text == null ? "" : text);
        data.put("subject", subject == null ? "" : subject);
        notifyListeners("shareReceived", data, true);
    }

    /** A button on the home screen widget was tapped. */
    public void deliverAction(String action, String kind, String id) {
        JSObject data = new JSObject();
        data.put("action", action);
        if (kind != null) {
            data.put("kind", kind);
        }
        if (id != null) {
            data.put("id", id);
        }
        notifyListeners("widgetAction", data, true);
    }

    /**
     * The phone's contacts (name, phone numbers, emails, address), for the
     * "Import from phone" picker. Asks for permission the first time. Nothing is
     * stored or sent anywhere here: the web side shows a list and imports only
     * what the person ticks.
     */
    @PluginMethod
    public void readContacts(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            requestPermissionForAlias("contacts", call, "contactsPermissionCallback");
            return;
        }
        loadContacts(call);
    }

    @PermissionCallback
    private void contactsPermissionCallback(PluginCall call) {
        if (getPermissionState("contacts") == PermissionState.GRANTED) {
            loadContacts(call);
        } else {
            call.reject("Contacts permission was not granted.", "denied");
        }
    }

    private void loadContacts(PluginCall call) {
        ContentResolver resolver = getContext().getContentResolver();
        String[] projection = {
            ContactsContract.Data.CONTACT_ID,
            ContactsContract.Data.MIMETYPE,
            ContactsContract.Data.DISPLAY_NAME,
            ContactsContract.Data.DATA1
        };
        String selection = ContactsContract.Data.MIMETYPE + " IN (?,?,?,?)";
        String[] args = {
            ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE,
            ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE,
            ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE,
            ContactsContract.CommonDataKinds.StructuredPostal.CONTENT_ITEM_TYPE
        };
        Map<Long, JSObject> byId = new LinkedHashMap<>();
        try (Cursor cursor = resolver.query(
            ContactsContract.Data.CONTENT_URI, projection, selection, args, ContactsContract.Data.CONTACT_ID)) {
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    long id = cursor.getLong(0);
                    String mime = cursor.getString(1);
                    String display = cursor.getString(2);
                    String value = cursor.getString(3);
                    JSObject contact = byId.get(id);
                    if (contact == null) {
                        contact = new JSObject();
                        contact.put("id", String.valueOf(id));
                        contact.put("name", display == null ? "" : display);
                        contact.put("phones", new JSONArray());
                        contact.put("emails", new JSONArray());
                        contact.put("addresses", new JSONArray());
                        byId.put(id, contact);
                    }
                    if (value == null || value.trim().isEmpty()) {
                        continue;
                    }
                    String key = null;
                    if (ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE.equals(mime)) {
                        key = "phones";
                    } else if (ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE.equals(mime)) {
                        key = "emails";
                    } else if (ContactsContract.CommonDataKinds.StructuredPostal.CONTENT_ITEM_TYPE.equals(mime)) {
                        key = "addresses";
                    }
                    if (key != null) {
                        contact.getJSONArray(key).put(value.trim());
                    }
                }
            }
            JSONArray list = new JSONArray();
            for (JSObject contact : byId.values()) {
                list.put(contact);
            }
            JSObject result = new JSObject();
            result.put("contacts", list);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not read contacts: " + e.getMessage());
        }
    }

    // --- The phone's calendar (read only) -------------------------------------

    /** Which calendars are on the phone, so the person can choose what to import. */
    @PluginMethod
    public void readCalendars(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED) {
            requestPermissionForAlias("calendar", call, "calendarPermissionCallback");
            return;
        }
        loadCalendars(call);
    }

    /** Events between startMs and endMs (recurring ones already expanded) from the chosen calendars. */
    @PluginMethod
    public void readCalendarEvents(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED) {
            requestPermissionForAlias("calendar", call, "calendarPermissionCallback");
            return;
        }
        loadCalendarEvents(call);
    }

    @PermissionCallback
    private void calendarPermissionCallback(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED) {
            call.reject("Calendar permission was not granted.", "denied");
        } else if ("readCalendars".equals(call.getMethodName())) {
            loadCalendars(call);
        } else {
            loadCalendarEvents(call);
        }
    }

    private void loadCalendars(PluginCall call) {
        ContentResolver resolver = getContext().getContentResolver();
        String[] projection = {
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
            CalendarContract.Calendars.ACCOUNT_NAME,
            CalendarContract.Calendars.CALENDAR_COLOR,
            CalendarContract.Calendars.VISIBLE
        };
        JSONArray list = new JSONArray();
        try (Cursor cursor = resolver.query(CalendarContract.Calendars.CONTENT_URI, projection, null, null, null)) {
            while (cursor != null && cursor.moveToNext()) {
                JSObject cal = new JSObject();
                cal.put("id", String.valueOf(cursor.getLong(0)));
                cal.put("name", cursor.getString(1) == null ? "" : cursor.getString(1));
                cal.put("account", cursor.getString(2) == null ? "" : cursor.getString(2));
                cal.put("color", cursor.getInt(3));
                cal.put("visible", cursor.getInt(4) != 0);
                list.put(cal);
            }
            JSObject result = new JSObject();
            result.put("calendars", list);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not read calendars: " + e.getMessage());
        }
    }

    private void loadCalendarEvents(PluginCall call) {
        try {
            JSONArray ids = call.getArray("calendarIds");
            long start = call.getData().getLong("startMs");
            long end = call.getData().getLong("endMs");
            if (ids == null || ids.length() == 0 || end <= start) {
                call.reject("Choose at least one calendar and a date range.");
                return;
            }
            StringBuilder marks = new StringBuilder();
            String[] args = new String[ids.length()];
            for (int i = 0; i < ids.length(); i++) {
                marks.append(i == 0 ? "?" : ",?");
                args[i] = String.valueOf(ids.getString(i));
            }
            Uri.Builder builder = CalendarContract.Instances.CONTENT_URI.buildUpon();
            ContentUris.appendId(builder, start);
            ContentUris.appendId(builder, end);
            String[] projection = {
                CalendarContract.Instances.EVENT_ID,
                CalendarContract.Instances.BEGIN,
                CalendarContract.Instances.END,
                CalendarContract.Instances.TITLE,
                CalendarContract.Instances.EVENT_LOCATION,
                CalendarContract.Instances.DESCRIPTION,
                CalendarContract.Instances.ALL_DAY,
                CalendarContract.Instances.CALENDAR_ID
            };
            String selection = CalendarContract.Instances.CALENDAR_ID + " IN (" + marks + ")";
            JSONArray list = new JSONArray();
            try (Cursor cursor = getContext().getContentResolver().query(
                builder.build(), projection, selection, args, CalendarContract.Instances.BEGIN + " ASC")) {
                while (cursor != null && cursor.moveToNext() && list.length() < 3000) {
                    JSObject ev = new JSObject();
                    ev.put("eventId", String.valueOf(cursor.getLong(0)));
                    ev.put("begin", cursor.getLong(1));
                    ev.put("end", cursor.getLong(2));
                    ev.put("title", cursor.getString(3) == null ? "" : cursor.getString(3));
                    ev.put("location", cursor.getString(4) == null ? "" : cursor.getString(4));
                    ev.put("description", cursor.getString(5) == null ? "" : cursor.getString(5));
                    ev.put("allDay", cursor.getInt(6) != 0);
                    ev.put("calendarId", String.valueOf(cursor.getLong(7)));
                    list.put(ev);
                }
            }
            JSObject result = new JSObject();
            result.put("events", list);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not read events: " + e.getMessage());
        }
    }
}
