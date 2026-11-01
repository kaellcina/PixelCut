package com.pixelcut.editor.media;

import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.OverlaySettings;
import androidx.media3.common.VideoCompositorSettings;
import androidx.media3.common.util.Size;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.effect.StaticOverlaySettings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

@OptIn(markerClass = UnstableApi.class)
final class TransitionCompositor implements VideoCompositorSettings {
    private final int width;
    private final int height;
    private final JSONArray transitions;

    TransitionCompositor(int width, int height, JSONArray transitions) {
        this.width = width;
        this.height = height;
        this.transitions = transitions == null ? new JSONArray() : transitions;
    }

    @Override
    public Size getOutputSize(List<Size> inputSizes) {
        return new Size(width, height);
    }

    @Override
    public OverlaySettings getOverlaySettings(int inputId, long presentationTimeUs) {
        JSONObject active = activeTransition(presentationTimeUs);
        float alpha = 1f;
        if (active != null) {
            long startUs = C.msToUs(active.optLong("startMs"));
            long durationUs = C.msToUs(active.optLong("durationMs"));
            float progress = durationUs <= 0 ? 1f : (presentationTimeUs - startUs) / (float) durationUs;
            String type = active.optString("type");
            boolean overlayIncoming = active.optBoolean("overlayIncoming", true);
            alpha = inputId == 0
                ? TransitionMath.primaryOverlayAlpha(type, progress, overlayIncoming)
                : TransitionMath.secondaryOverlayAlpha(type, progress, overlayIncoming);
        }
        return new StaticOverlaySettings.Builder().setAlphaScale(alpha).build();
    }

    private JSONObject activeTransition(long presentationTimeUs) {
        long timeMs = presentationTimeUs / 1000L;
        for (int i = 0; i < transitions.length(); i++) {
            JSONObject item = transitions.optJSONObject(i);
            if (item == null) continue;
            long start = item.optLong("startMs");
            long end = item.optLong("endMs", start + item.optLong("durationMs"));
            if (timeMs >= start && timeMs < end) return item;
        }
        return null;
    }
}
