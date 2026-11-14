package com.keystoneplanner.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** A goal's + or a task's tick box on a widget: remember it for the app, and show it at once. */
public class WidgetActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String taskId = intent.getStringExtra("taskId");
        if (taskId != null && !taskId.isEmpty()) {
            WidgetKit.recordTaskDone(context, taskId);
            WidgetKit.refreshAll(context);
            return;
        }
        String goalId = intent.getStringExtra("goalId");
        int delta = intent.getIntExtra("delta", 1);
        if (goalId == null || goalId.isEmpty()) {
            return;
        }
        WidgetKit.recordGoalLog(context, goalId, delta);
        WidgetKit.refreshAll(context);
    }
}
