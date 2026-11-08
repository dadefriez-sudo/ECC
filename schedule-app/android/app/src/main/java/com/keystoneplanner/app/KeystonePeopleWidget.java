package com.keystoneplanner.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** 4 x 2: up to three people to follow up, with call and message buttons on each row. */
public class KeystonePeopleWidget extends KeystoneWidgetBase {
    @Override
    protected RemoteViews build(Context context, AppWidgetManager manager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_people);
        int[] rows = {R.id.pp_row_0, R.id.pp_row_1, R.id.pp_row_2};
        int[] avatars = {R.id.pp_avatar_0, R.id.pp_avatar_1, R.id.pp_avatar_2};
        int[] texts = {R.id.pp_text_0, R.id.pp_text_1, R.id.pp_text_2};
        int[] names = {R.id.pp_name_0, R.id.pp_name_1, R.id.pp_name_2};
        int[] subs = {R.id.pp_sub_0, R.id.pp_sub_1, R.id.pp_sub_2};
        int[] calls = {R.id.pp_call_0, R.id.pp_call_1, R.id.pp_call_2};
        int[] msgs = {R.id.pp_msg_0, R.id.pp_msg_1, R.id.pp_msg_2};
        for (int row : rows) {
            views.setViewVisibility(row, View.GONE);
        }
        JSONObject data = WidgetKit.data(context);
        JSONArray people = data == null ? null : data.optJSONArray("people");
        int count = people == null ? 0 : Math.min(people.length(), rows.length);
        for (int i = 0; i < count; i++) {
            JSONObject p = people.optJSONObject(i);
            if (p == null) {
                continue;
            }
            String name = p.optString("n", "");
            String phone = p.optString("p", "");
            views.setImageViewBitmap(avatars[i], WidgetKit.avatar(context, name, WidgetKit.parseColor(p.optString("c", ""), 0xFF93A0AD), 36));
            views.setTextViewText(names[i], name);
            views.setTextViewText(subs[i], p.optString("l", ""));
            views.setOnClickPendingIntent(texts[i], WidgetKit.open(context, 270 + i, "openContact", null, p.optString("i", "")));
            views.setOnClickPendingIntent(avatars[i], WidgetKit.open(context, 270 + i, "openContact", null, p.optString("i", "")));
            if (phone.isEmpty()) {
                views.setViewVisibility(calls[i], View.INVISIBLE);
                views.setViewVisibility(msgs[i], View.INVISIBLE);
            } else {
                views.setViewVisibility(calls[i], View.VISIBLE);
                views.setViewVisibility(msgs[i], View.VISIBLE);
                views.setOnClickPendingIntent(calls[i], WidgetKit.dial(context, 273 + i, phone));
                views.setOnClickPendingIntent(msgs[i], WidgetKit.sms(context, 276 + i, phone));
            }
            views.setViewVisibility(rows[i], View.VISIBLE);
        }
        views.setTextViewText(
            R.id.pp_title,
            data == null ? "OPEN KEYSTONE TO SEE PEOPLE" : count == 0 ? "NOBODY IS WAITING ON YOU" : "PEOPLE TO FOLLOW UP");
        views.setOnClickPendingIntent(R.id.pp_root, WidgetKit.open(context, 269, "openPeople", null, null));
        return views;
    }
}
