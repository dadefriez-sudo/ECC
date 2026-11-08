package com.keystoneplanner.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;

/** 1 x 1: one tap to a new event. */
public class KeystoneQuickEventWidget extends KeystoneWidgetBase {
    @Override
    protected RemoteViews build(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quickevent);
        views.setOnClickPendingIntent(R.id.qe_root, WidgetKit.open(context, 221, "newEvent", null, null));
        return views;
    }
}
