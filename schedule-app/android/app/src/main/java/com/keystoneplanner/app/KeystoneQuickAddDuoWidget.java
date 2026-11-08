package com.keystoneplanner.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;

/** 2 x 1: + Event and + Task. */
public class KeystoneQuickAddDuoWidget extends KeystoneWidgetBase {
    @Override
    protected RemoteViews build(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quickadd_duo);
        views.setOnClickPendingIntent(R.id.duo_event, WidgetKit.open(context, 211, "newEvent", null, null));
        views.setOnClickPendingIntent(R.id.duo_task, WidgetKit.open(context, 212, "newTask", null, null));
        return views;
    }
}
