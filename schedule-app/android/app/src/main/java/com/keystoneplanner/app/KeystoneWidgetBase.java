package com.keystoneplanner.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;

/** What every Keystone home screen widget shares: build the views, refresh on update and resize. */
public abstract class KeystoneWidgetBase extends AppWidgetProvider {

    protected abstract RemoteViews build(Context context, AppWidgetManager manager, int appWidgetId);

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, build(context, manager, id));
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        manager.updateAppWidget(appWidgetId, build(context, manager, appWidgetId));
    }

    final void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, getClass()));
        if (ids == null) {
            return;
        }
        for (int id : ids) {
            manager.updateAppWidget(id, build(context, manager, id));
        }
    }
}
