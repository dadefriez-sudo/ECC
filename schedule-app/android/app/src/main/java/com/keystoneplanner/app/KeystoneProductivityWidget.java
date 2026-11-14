package com.keystoneplanner.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 4 x 2: today's ring (done of due), the next three tasks with tick boxes that finish them
 * without opening the app, this week's finished tasks as bars, and a + for a new task.
 */
public class KeystoneProductivityWidget extends KeystoneWidgetBase {
    @Override
    protected RemoteViews build(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_productivity);
        int[] rows = {R.id.pr_row_0, R.id.pr_row_1, R.id.pr_row_2};
        int[] boxes = {R.id.pr_cb_0, R.id.pr_cb_1, R.id.pr_cb_2};
        int[] names = {R.id.pr_name_0, R.id.pr_name_1, R.id.pr_name_2};
        for (int row : rows) {
            views.setViewVisibility(row, View.INVISIBLE);
        }
        JSONObject data = WidgetKit.data(context);
        JSONObject prod = data == null ? null : data.optJSONObject("prod");

        int done = prod == null ? 0 : prod.optInt("n", 0);
        int left = prod == null ? 0 : prod.optInt("l", 0);
        int percent = prod == null ? 0 : prod.optInt("p", 0);
        int streak = prod == null ? 0 : prod.optInt("s", 0);
        String centre = done + left == 0 ? "–" : done + "/" + (done + left);
        views.setImageViewBitmap(R.id.pr_ring, WidgetKit.ring(context, percent, 50, true, centre));
        if (prod != null) {
            views.setImageViewBitmap(
                R.id.pr_bars,
                WidgetKit.bars(context, prod.optJSONArray("w"), prod.optInt("d", -1), prod.optJSONArray("h"), 92, 30));
        }

        String head;
        if (prod == null) {
            head = "OPEN KEYSTONE TO SEE TASKS";
        } else {
            head = "PRODUCTIVITY · " + (left == 0 ? "ALL CLEAR" : left + " LEFT");
            if (streak >= 2) {
                head += " · 🔥" + streak;
            }
        }
        views.setTextViewText(R.id.pr_title, head);

        JSONArray top = prod == null ? null : prod.optJSONArray("top");
        int count = top == null ? 0 : Math.min(top.length(), rows.length);
        for (int i = 0; i < count; i++) {
            JSONObject t = top.optJSONObject(i);
            if (t == null) {
                continue;
            }
            String id = t.optString("i", "");
            String when = t.optString("t", "");
            String name = t.optString("n", "");
            views.setTextViewText(names[i], when.isEmpty() ? name : name + "  ·  " + when);
            views.setOnClickPendingIntent(boxes[i], WidgetKit.doneTask(context, 290 + i, id));
            views.setOnClickPendingIntent(names[i], WidgetKit.open(context, 293 + i, "openItem", "task", id));
            views.setViewVisibility(rows[i], View.VISIBLE);
        }
        if (count == 0 && prod != null) {
            views.setTextViewText(names[0], "Nothing due today. Tap + to add a task.");
            views.setViewVisibility(boxes[0], View.INVISIBLE);
            views.setViewVisibility(rows[0], View.VISIBLE);
        } else {
            views.setViewVisibility(boxes[0], View.VISIBLE);
        }
        views.setOnClickPendingIntent(R.id.pr_root, WidgetKit.open(context, 296, "openTasks", null, null));
        views.setOnClickPendingIntent(R.id.pr_ring, WidgetKit.open(context, 296, "openTasks", null, null));
        views.setOnClickPendingIntent(R.id.pr_add, WidgetKit.open(context, 297, "newTask", null, null));
        return views;
    }
}
