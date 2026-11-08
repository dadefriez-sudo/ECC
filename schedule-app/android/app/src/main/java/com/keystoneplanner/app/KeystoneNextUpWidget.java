package com.keystoneplanner.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** 2 x 1: the next thing on the day and how long until it. */
public class KeystoneNextUpWidget extends KeystoneWidgetBase {
    @Override
    protected RemoteViews build(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_nextup);
        JSONObject data = WidgetKit.data(context);
        JSONObject next = data == null ? null : data.optJSONObject("next");
        if (data == null) {
            views.setTextViewText(R.id.nx_eyebrow, "NEXT UP");
            views.setTextViewText(R.id.nx_title, "Open Keystone");
            views.setTextViewText(R.id.nx_sub, "to see today");
        } else if (next == null) {
            views.setTextViewText(R.id.nx_eyebrow, "NEXT UP");
            views.setTextViewText(R.id.nx_title, "All clear");
            views.setTextViewText(R.id.nx_sub, "Nothing else today");
        } else {
            String when = "";
            if (!next.isNull("m")) {
                int mins = next.optInt("m", 0);
                when = mins <= 1 ? " · NOW" : mins < 60 ? " · IN " + mins + " MIN" : " · IN " + Math.round(mins / 60f) + " HR";
            }
            views.setTextViewText(R.id.nx_eyebrow, "NEXT UP" + when);
            views.setTextViewText(R.id.nx_title, next.optString("n", ""));
            String time = next.optString("t", "");
            String loc = next.optString("loc", "");
            String sub = (time.isEmpty() ? "Anytime today" : time) + (loc.isEmpty() ? "" : " · " + loc);
            views.setTextViewText(R.id.nx_sub, sub);
            views.setOnClickPendingIntent(
                R.id.nx_root,
                WidgetKit.open(context, 231, "openItem", next.optString("k", "event"), next.optString("i", "")));
            return views;
        }
        views.setOnClickPendingIntent(R.id.nx_root, WidgetKit.open(context, 230, "openPlanner", null, null));
        return views;
    }
}
