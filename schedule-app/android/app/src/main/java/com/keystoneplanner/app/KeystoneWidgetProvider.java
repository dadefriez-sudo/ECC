package com.keystoneplanner.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * "Today" home screen widget: the next few things on the day, and a + button
 * that opens Keystone straight into a new task. The web app writes a small
 * JSON summary through KeystoneBridgePlugin whenever it changes; this class
 * only reads it back, so the widget never needs to open the app's storage.
 */
public class KeystoneWidgetProvider extends AppWidgetProvider {

    private static final String PREFS = "keystone_widget";
    private static final String KEY = "data";

    static void save(Context context, String json) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY, json).apply();
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, KeystoneWidgetProvider.class));
        if (ids == null) {
            return;
        }
        for (int id : ids) {
            manager.updateAppWidget(id, build(context));
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, build(context));
        }
    }

    private static RemoteViews build(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.keystone_widget);
        int[] rowIds = {R.id.widget_row_0, R.id.widget_row_1, R.id.widget_row_2, R.id.widget_row_3};

        for (int rowId : rowIds) {
            views.setViewVisibility(rowId, View.GONE);
        }
        views.setViewVisibility(R.id.widget_more, View.GONE);

        String json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        boolean filled = false;

        if (json != null) {
            try {
                JSONObject data = new JSONObject(json);
                if (today.equals(data.optString("day"))) {
                    JSONArray items = data.optJSONArray("items");
                    int count = items == null ? 0 : Math.min(items.length(), rowIds.length);
                    for (int i = 0; i < count; i++) {
                        JSONObject item = items.getJSONObject(i);
                        String time = item.optString("t", "");
                        String name = item.optString("n", "");
                        String line = time.isEmpty() ? name : time + "  " + name;
                        views.setTextViewText(rowIds[i], line);
                        views.setViewVisibility(rowIds[i], View.VISIBLE);
                        filled = true;
                    }
                    int more = data.optInt("more", 0);
                    if (more > 0) {
                        views.setTextViewText(R.id.widget_more, "+" + more + " more");
                        views.setViewVisibility(R.id.widget_more, View.VISIBLE);
                    }
                    if (!filled) {
                        views.setTextViewText(rowIds[0], "Nothing else today");
                        views.setViewVisibility(rowIds[0], View.VISIBLE);
                        filled = true;
                    }
                }
            } catch (JSONException ignored) {
                // Fall through to the placeholder below.
            }
        }

        if (!filled) {
            views.setTextViewText(rowIds[0], "Open Keystone to see today");
            views.setViewVisibility(rowIds[0], View.VISIBLE);
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open, flags));

        Intent add = new Intent(context, MainActivity.class);
        add.setAction("com.keystoneplanner.app.WIDGET_NEW_TASK");
        add.putExtra("keystoneAction", "newTask");
        add.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        views.setOnClickPendingIntent(R.id.widget_add, PendingIntent.getActivity(context, 1, add, flags));

        return views;
    }
}
