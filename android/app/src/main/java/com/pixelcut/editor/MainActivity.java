package com.pixelcut.editor;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PixelCutPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
