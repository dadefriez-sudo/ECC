package com.keystoneplanner.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** 2 x 2: up to three goals, each with a ring and a + that logs it without opening the app. */
public class KeystoneGoalLogWidget extends KeystoneWidgetBase {
    @Override
    protected RemoteViews build(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_goallog);
        int[] rows = {R.id.gl_row_0, R.id.gl_row_1, R.id.gl_row_2};
        int[] rings = {R.id.gl_ring_0, R.id.gl_ring_1, R.id.gl_ring_2};
        int[] names = {R.id.gl_name_0, R.id.gl_name_1, R.id.gl_name_2};
        int[] subs = {R.id.gl_sub_0, R.id.gl_sub_1, R.id.gl_sub_2};
        int[] pluses = {R.id.gl_plus_0, R.id.gl_plus_1, R.id.gl_plus_2};
        for (int row : rows) {
            views.setViewVisibility(row, View.GONE);
        }
        JSONObject data = WidgetKit.data(context);
        JSONArray goals = data == null ? null : data.optJSONArray("goals");
        int count = goals == null ? 0 : Math.min(goals.length(), rows.length);
        for (int i = 0; i < count; i++) {
            JSONObject g = goals.optJSONObject(i);
            if (g == null) {
                continue;
            }
            int value = g.optInt("v", 0);
            int target = Math.max(1, g.optInt("g", 1));
            int step = Math.max(1, g.optInt("s", 1));
            boolean done = value >= target;
            views.setImageViewBitmap(rings[i], WidgetKit.ring(context, Math.min(100, value * 100 / target), 34));
            views.setTextViewText(names[i], g.optString("n", ""));
            views.setTextViewText(subs[i], done ? "Done" : value + " of " + target);
            views.setTextViewText(pluses[i], done ? "✓" : "+");
            if (!done) {
                views.setOnClickPendingIntent(
                    pluses[i], WidgetKit.logGoal(context, 241 + i, g.optString("i", ""), step));
            } else {
                views.setOnClickPendingIntent(pluses[i], WidgetKit.open(context, 244 + i, "openGoals", null, null));
            }
            views.setViewVisibility(rows[i], View.VISIBLE);
        }
        if (count == 0) {
            views.setTextViewText(R.id.gl_title, data == null ? "OPEN KEYSTONE TO SEE GOALS" : "NO GOALS IN PLAY TODAY");
        } else {
            views.setTextViewText(R.id.gl_title, "GOALS TODAY");
        }
        views.setOnClickPendingIntent(R.id.gl_root, WidgetKit.open(context, 240, "openGoals", null, null));
        return views;
    }
}
