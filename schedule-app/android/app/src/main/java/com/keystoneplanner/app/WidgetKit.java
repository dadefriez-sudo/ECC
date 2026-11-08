package com.keystoneplanner.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Shared pieces for the home screen widgets: the summary the web app writes
 * (read back here), the taps that open Keystone or call and text someone, goal
 * taps made without opening the app, and the small pictures (rings, avatars, the
 * month grid) drawn on a Canvas because a widget can only show a limited set of
 * views.
 */
final class WidgetKit {
    static final String PREFS = "keystone_widget";
    static final String KEY = "data";
    static final String LOGS = "logs";
    static final int FLAGS = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

    static final int GOLD = 0xFFE0C15A;
    static final int INK = 0xFFF3EDE0;
    static final int MUTED = 0xFF93A0AD;
    static final int CARD = 0xFF232C37;
    static final int TRACK = 0xFF33404E;
    static final int DARK = 0xFF1A212A;

    private WidgetKit() {}

    /** Every widget type, so one change can redraw them all. */
    private static KeystoneWidgetBase[] all() {
        return new KeystoneWidgetBase[] {
            new KeystoneQuickAddBarWidget(),
            new KeystoneQuickAddDuoWidget(),
            new KeystoneQuickEventWidget(),
            new KeystoneNextUpWidget(),
            new KeystoneGoalLogWidget(),
            new KeystoneStreakWidget(),
            new KeystoneWeekWidget(),
            new KeystonePeopleWidget(),
            new KeystoneMonthWidget(),
        };
    }

    static void refreshAll(Context context) {
        for (KeystoneWidgetBase widget : all()) {
            widget.refresh(context);
        }
    }

    /** The saved summary, or null when there is none or it is from another day. */
    static JSONObject data(Context context) {
        String json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
        if (json == null) {
            return null;
        }
        try {
            JSONObject data = new JSONObject(json);
            String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            return today.equals(data.optString("day")) ? data : null;
        } catch (JSONException e) {
            return null;
        }
    }

    // --- Taps ---------------------------------------------------------------

    /** Opens Keystone and tells the web app what to do (new event, a goal, a contact...). */
    static PendingIntent open(Context context, int request, String action, String kind, String id) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction("com.keystoneplanner.app.WIDGET_" + action + "_" + (id == null ? "" : id) + "_" + request);
        if (action != null && !action.isEmpty()) {
            intent.putExtra("keystoneAction", action);
        }
        if (kind != null) {
            intent.putExtra("keystoneKind", kind);
        }
        if (id != null) {
            intent.putExtra("keystoneId", id);
        }
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, request, intent, FLAGS);
    }

    /** The phone's dialer with the number filled in (it never places the call by itself). */
    static PendingIntent dial(Context context, int request, String phone) {
        Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(phone)));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, request, intent, FLAGS);
    }

    /** The messaging app with a new message to the number. */
    static PendingIntent sms(Context context, int request, String phone) {
        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(phone)));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, request, intent, FLAGS);
    }

    /** A goal tap: handled by WidgetActionReceiver without opening the app. */
    static PendingIntent logGoal(Context context, int request, String goalId, int delta) {
        Intent intent = new Intent(context, WidgetActionReceiver.class);
        intent.setAction("com.keystoneplanner.app.WIDGET_LOG_" + goalId);
        intent.putExtra("goalId", goalId);
        intent.putExtra("delta", delta);
        return PendingIntent.getBroadcast(context, request, intent, FLAGS);
    }

    /** Adds the tap to the list the web app reads next time it opens, and shows it now. */
    static void recordGoalLog(Context context, String goalId, int delta) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray logs = new JSONArray(prefs.getString(LOGS, "[]"));
            logs.put(new JSONObject().put("i", goalId).put("d", delta));
            SharedPreferences.Editor edit = prefs.edit().putString(LOGS, logs.toString());
            String json = prefs.getString(KEY, null);
            if (json != null) {
                JSONObject data = new JSONObject(json);
                JSONArray goals = data.optJSONArray("goals");
                for (int i = 0; goals != null && i < goals.length(); i++) {
                    JSONObject g = goals.getJSONObject(i);
                    if (goalId.equals(g.optString("i"))) {
                        g.put("v", Math.max(0, g.optInt("v", 0) + delta));
                    }
                }
                edit.putString(KEY, data.toString());
            }
            edit.apply();
        } catch (JSONException ignored) {
            // A bad value is dropped; the web app's own copy is the source of truth.
        }
    }

    /** Taps left by the widget since the web app last looked, as a JSON array; clears them. */
    static String takeLogs(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String logs = prefs.getString(LOGS, "[]");
        prefs.edit().remove(LOGS).apply();
        return logs;
    }

    // --- Pictures -----------------------------------------------------------

    private static Paint paint(int color) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(color);
        return p;
    }

    /** A progress ring with the percentage inside. */
    static Bitmap ring(Context context, int percent, int sizeDp) {
        float density = context.getResources().getDisplayMetrics().density;
        int size = Math.max(16, Math.round(sizeDp * density));
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        float stroke = size * 0.13f;
        RectF box = new RectF(stroke / 2, stroke / 2, size - stroke / 2, size - stroke / 2);
        Paint track = paint(TRACK);
        track.setStyle(Paint.Style.STROKE);
        track.setStrokeWidth(stroke);
        canvas.drawArc(box, 0, 360, false, track);
        Paint arc = paint(GOLD);
        arc.setStyle(Paint.Style.STROKE);
        arc.setStrokeWidth(stroke);
        arc.setStrokeCap(Paint.Cap.ROUND);
        canvas.drawArc(box, -90, 360f * Math.max(0, Math.min(100, percent)) / 100f, false, arc);
        Paint text = paint(INK);
        text.setTextAlign(Paint.Align.CENTER);
        text.setTypeface(Typeface.DEFAULT_BOLD);
        text.setTextSize(size * 0.27f);
        canvas.drawText(percent + "%", size / 2f, size / 2f + text.getTextSize() * 0.35f, text);
        return bitmap;
    }

    /** A round avatar with initials. */
    static Bitmap avatar(Context context, String name, int color, int sizeDp) {
        float density = context.getResources().getDisplayMetrics().density;
        int size = Math.max(16, Math.round(sizeDp * density));
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint(color));
        Paint text = paint(0xFFFFFFFF);
        text.setTextAlign(Paint.Align.CENTER);
        text.setTypeface(Typeface.DEFAULT_BOLD);
        text.setTextSize(size * 0.38f);
        canvas.drawText(initials(name), size / 2f, size / 2f + text.getTextSize() * 0.35f, text);
        return bitmap;
    }

    static String initials(String name) {
        if (name == null) {
            return "?";
        }
        String[] parts = name.trim().split("\\s+");
        String out = "";
        for (int i = 0; i < parts.length && out.length() < 2; i++) {
            if (!parts[i].isEmpty()) {
                out += parts[i].substring(0, 1).toUpperCase(Locale.getDefault());
            }
        }
        return out.isEmpty() ? "?" : out;
    }

    static int parseColor(String hex, int fallback) {
        try {
            return android.graphics.Color.parseColor(hex);
        } catch (IllegalArgumentException | NullPointerException e) {
            return fallback;
        }
    }

    /** The month as a grid: weekday letters, the dates, today circled, a dot on busy days. */
    static Bitmap month(Context context, JSONObject month, int widthDp, int heightDp) {
        float density = context.getResources().getDisplayMetrics().density;
        int w = Math.max(80, Math.round(widthDp * density));
        int h = Math.max(60, Math.round(heightDp * density));
        Bitmap bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        int offset = month.optInt("o", 0);
        int days = month.optInt("n", 30);
        int today = month.optInt("d", 0);
        JSONArray counts = month.optJSONArray("c");
        JSONArray heads = month.optJSONArray("h");
        int rows = (offset + days + 6) / 7;
        float cellW = w / 7f;
        float cellH = h / (rows + 1f);

        Paint head = paint(MUTED);
        head.setTextAlign(Paint.Align.CENTER);
        head.setTypeface(Typeface.DEFAULT_BOLD);
        head.setTextSize(Math.min(cellH * 0.5f, 11 * density));
        for (int c = 0; c < 7; c++) {
            String letter = heads != null && c < heads.length() ? heads.optString(c, "") : "";
            canvas.drawText(letter, cellW * (c + 0.5f), cellH * 0.7f, head);
        }

        Paint num = paint(INK);
        num.setTextAlign(Paint.Align.CENTER);
        num.setTypeface(Typeface.DEFAULT_BOLD);
        num.setTextSize(Math.min(cellH * 0.55f, 13 * density));
        Paint ring = paint(GOLD);
        Paint dot = paint(GOLD);
        for (int d = 1; d <= days; d++) {
            int slot = offset + d - 1;
            int row = slot / 7 + 1;
            int col = slot % 7;
            float cx = cellW * (col + 0.5f);
            float cy = cellH * (row + 0.5f);
            boolean isToday = d == today;
            if (isToday) {
                canvas.drawCircle(cx, cy - cellH * 0.04f, Math.min(cellW, cellH) * 0.42f, ring);
                num.setColor(0xFF16130A);
            } else {
                num.setColor(INK);
            }
            canvas.drawText(String.valueOf(d), cx, cy + num.getTextSize() * 0.3f, num);
            if (counts != null && d - 1 < counts.length() && counts.optInt(d - 1, 0) > 0) {
                dot.setColor(isToday ? 0xFF16130A : GOLD);
                canvas.drawCircle(cx, cy + cellH * 0.36f, Math.max(1.5f * density, cellH * 0.06f), dot);
            }
        }
        return bitmap;
    }
}
