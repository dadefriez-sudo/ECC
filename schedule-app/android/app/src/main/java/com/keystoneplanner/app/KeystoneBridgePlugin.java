package com.keystoneplanner.app;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Small bridge between the web app and Android: it hands the home screen
 * widget its data, and tells the web app when something was shared into
 * Keystone or the widget was tapped. Events are retained until the web side
 * starts listening, so a cold start from the share sheet is not lost.
 */
@CapacitorPlugin(name = "KeystoneBridge")
public class KeystoneBridgePlugin extends Plugin {

    @PluginMethod
    public void updateWidget(PluginCall call) {
        String json = call.getString("json");
        Context context = getContext();
        if (json != null) {
            KeystoneWidgetProvider.save(context, json);
        }
        KeystoneWidgetProvider.refreshAll(context);
        call.resolve();
    }

    /** Text shared into Keystone from another app. */
    public void deliverShare(String text, String subject) {
        JSObject data = new JSObject();
        data.put("text", text == null ? "" : text);
        data.put("subject", subject == null ? "" : subject);
        notifyListeners("shareReceived", data, true);
    }

    /** A button on the home screen widget was tapped. */
    public void deliverAction(String action) {
        JSObject data = new JSObject();
        data.put("action", action);
        notifyListeners("widgetAction", data, true);
    }
}
