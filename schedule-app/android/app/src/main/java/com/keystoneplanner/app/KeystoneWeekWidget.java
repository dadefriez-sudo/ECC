package com.keystoneplanner.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** 4 x 1: the week, today highlighted, a dot for each event; tapping a day opens it. */
public class KeystoneWeekWidget extends KeystoneWidgetBase {
    @Override
    protected RemoteViews build(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_week);
        int[] cols = {R.id.wk_col_0, R.id.wk_col_1, R.id.wk_col_2, R.id.wk_col_3, R.id.wk_col_4, R.id.wk_col_5, R.id.wk_col_6};
        int[] days = {R.id.wk_day_0, R.id.wk_day_1, R.id.wk_day_2, R.id.wk_day_3, R.id.wk_day_4, R.id.wk_day_5, R.id.wk_day_6};
        int[] nums = {R.id.wk_num_0, R.id.wk_num_1, R.id.wk_num_2, R.id.wk_num_3, R.id.wk_num_4, R.id.wk_num_5, R.id.wk_num_6};
        int[] dots = {R.id.wk_dots_0, R.id.wk_dots_1, R.id.wk_dots_2, R.id.wk_dots_3, R.id.wk_dots_4, R.id.wk_dots_5, R.id.wk_dots_6};
        JSONObject data = WidgetKit.data(context);
        JSONArray week = data == null ? null : data.optJSONArray("week");
        for (int i = 0; i < cols.length; i++) {
            JSONObject d = week == null ? null : week.optJSONObject(i);
            if (d == null) {
                views.setTextViewText(days[i], "");
                views.setTextViewText(nums[i], i == 0 ? "Open" : i == 1 ? "Keystone" : "");
                views.setTextViewText(dots[i], "");
                views.setOnClickPendingIntent(cols[i], WidgetKit.open(context, 260 + i, "openPlanner", null, null));
                continue;
            }
            boolean today = d.optBoolean("t", false);
            int count = Math.min(3, d.optInt("c", 0));
            views.setTextViewText(days[i], d.optString("d", ""));
            views.setTextViewText(nums[i], String.valueOf(d.optInt("n", 0)));
            StringBuilder marks = new StringBuilder();
            for (int k = 0; k < count; k++) {
                marks.append("●");
            }
            views.setTextViewText(dots[i], marks.toString());
            views.setInt(cols[i], "setBackgroundResource", today ? R.drawable.widget_today_bg : R.drawable.widget_blank_bg);
            views.setTextColor(nums[i], today ? 0xFF16130A : WidgetKit.INK);
            views.setTextColor(days[i], today ? 0xFF5A4A10 : WidgetKit.MUTED);
            views.setTextColor(dots[i], today ? 0xFF16130A : WidgetKit.GOLD);
            views.setOnClickPendingIntent(cols[i], WidgetKit.open(context, 260 + i, "openPlanner", null, d.optString("iso", "")));
        }
        return views;
    }
}
