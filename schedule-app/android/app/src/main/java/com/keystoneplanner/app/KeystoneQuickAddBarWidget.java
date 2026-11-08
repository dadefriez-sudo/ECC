package com.keystoneplanner.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.widget.RemoteViews;

/** 4 x 1: Event, Task, Note and Person, each opening its form in Keystone. */
public class KeystoneQuickAddBarWidget extends KeystoneWidgetBase {
    @Override
    protected RemoteViews build(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quickadd_bar);
        views.setOnClickPendingIntent(R.id.qab_event, WidgetKit.open(context, 201, "newEvent", null, null));
        views.setOnClickPendingIntent(R.id.qab_task, WidgetKit.open(context, 202, "newTask", null, null));
        views.setOnClickPendingIntent(R.id.qab_note, WidgetKit.open(context, 203, "newNote", null, null));
        views.setOnClickPendingIntent(R.id.qab_person, WidgetKit.open(context, 204, "newPerson", null, null));
        return views;
    }
}
