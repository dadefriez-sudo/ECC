package com.keystoneplanner.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** 4 x 3: the month with a dot on busy days, the next two items, and a + for a new event. */
public class KeystoneMonthWidget extends KeystoneWidgetBase {
    @Override
    protected RemoteViews build(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_month);
        JSONObject data = WidgetKit.data(context);
        JSONObject month = data == null ? null : data.optJSONObject("month");
        views.setTextViewText(R.id.mo_title, month == null ? "Open Keystone" : month.optString("t", ""));
        if (month != null) {
            views.setImageViewBitmap(R.id.mo_grid, WidgetKit.month(context, month, 260, 150));
        }
        JSONArray items = data == null ? null : data.optJSONArray("items");
        int[] ids = {R.id.mo_item_0, R.id.mo_item_1};
        for (int i = 0; i < ids.length; i++) {
            JSONObject item = items == null ? null : items.optJSONObject(i);
            if (item == null) {
                views.setTextViewText(ids[i], i == 0 && data != null ? "Nothing else today" : "");
                continue;
            }
            String time = item.optString("t", "");
            views.setTextViewText(ids[i], (time.isEmpty() ? "Anytime" : time) + "   " + item.optString("n", ""));
        }
        views.setOnClickPendingIntent(R.id.mo_root, WidgetKit.open(context, 280, "openPlanner", null, "month"));
        views.setOnClickPendingIntent(R.id.mo_add, WidgetKit.open(context, 281, "newEvent", null, null));
        return views;
    }
}
