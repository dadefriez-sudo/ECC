package com.keystoneplanner.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** A goal's + on the widget: remember it for the app, and show the new count at once. */
public class WidgetActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String goalId = intent.getStringExtra("goalId");
        int delta = intent.getIntExtra("delta", 1);
        if (goalId == null || goalId.isEmpty()) {
            return;
        }
        WidgetKit.recordGoalLog(context, goalId, delta);
        WidgetKit.refreshAll(context);
    }
}
