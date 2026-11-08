package com.keystoneplanner.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** 2 x 1: today's ring, the week's percentage and the best streak. */
public class KeystoneStreakWidget extends KeystoneWidgetBase {
    @Override
    protected RemoteViews build(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_streak);
        JSONObject data = WidgetKit.data(context);
        int daily = data == null ? 0 : data.optInt("dp", 0);
        int weekly = data == null ? 0 : data.optInt("wp", 0);
        int streak = data == null ? 0 : data.optInt("streak", 0);
        views.setImageViewBitmap(R.id.sk_ring, WidgetKit.ring(context, daily, 48));
        views.setTextViewText(R.id.sk_streak, streak == 1 ? "1 day streak" : streak + " day streak");
        views.setTextViewText(R.id.sk_week, data == null ? "Open Keystone" : "Week " + weekly + "%");
        views.setOnClickPendingIntent(R.id.sk_root, WidgetKit.open(context, 250, "openGoals", null, null));
        return views;
    }
}
