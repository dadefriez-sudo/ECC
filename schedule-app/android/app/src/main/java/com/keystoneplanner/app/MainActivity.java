package com.keystoneplanner.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins defined in the app itself have to be registered before the
        // bridge is created, which happens inside super.onCreate().
        registerPlugin(KeystoneBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }

    // BridgeActivity calls this for the launching intent too, so it covers
    // both a cold start from the share sheet / widget and a later tap while
    // the app is already running (the activity is singleTask).
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleKeystoneIntent(intent);
    }

    private void handleKeystoneIntent(Intent intent) {
        if (intent == null || getBridge() == null) {
            return;
        }
        PluginHandle handle = getBridge().getPlugin("KeystoneBridge");
        if (handle == null) {
            return;
        }
        Plugin instance = handle.getInstance();
        if (!(instance instanceof KeystoneBridgePlugin)) {
            return;
        }
        KeystoneBridgePlugin plugin = (KeystoneBridgePlugin) instance;

        String type = intent.getType();
        if (Intent.ACTION_SEND.equals(intent.getAction()) && type != null && type.startsWith("text/")) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            if (text != null && !text.trim().isEmpty()) {
                plugin.deliverShare(text, subject);
            }
            // Consumed, so a rotation or relaunch does not offer it again.
            intent.setAction(Intent.ACTION_MAIN);
            intent.removeExtra(Intent.EXTRA_TEXT);
        }

        String action = intent.getStringExtra("keystoneAction");
        if (action != null) {
            plugin.deliverAction(action);
            intent.removeExtra("keystoneAction");
        }
    }
}
