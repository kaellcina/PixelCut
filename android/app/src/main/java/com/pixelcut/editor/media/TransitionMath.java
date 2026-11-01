package com.pixelcut.editor.media;

/**
 * Packed-transition mix used by the Media3 exporter. Keep this class free of
 * Android framework types so unit tests can check the same curves as the preview.
 */
public final class TransitionMath {
    private TransitionMath() {}

    public static float clamp01(float value) {
        if (value <= 0f) return 0f;
        if (value >= 1f) return 1f;
        return value;
    }

    /**
     * Media3 item effects see sequence timestamps, including the leading gap.
     * Subtract the composition start so fade/wipe windows stay clip-local.
     */
    public static long clipLocalUs(long presentationTimeUs, long originUs) {
        return presentationTimeUs - Math.max(0L, originUs);
    }

    public static boolean isWipe(String type) {
        return "wipeleft".equals(type)
            || "wiperight".equals(type)
            || "wipeup".equals(type)
            || "wipedown".equals(type);
    }

    public static boolean isFadeThrough(String type) {
        return "fadeblack".equals(type) || "fadewhite".equals(type);
    }

    /** Overlay sequence alpha. Primary stays opaque; spatial wipes keep alpha 1. */
    public static float overlayAlpha(String type, float progress, boolean overlayIncoming) {
        float p = clamp01(progress);
        if (type == null || type.isEmpty()) return 1f;
        if ("dissolve".equals(type)) return overlayIncoming ? p : 1f - p;
        if (isFadeThrough(type)) {
            if (overlayIncoming) return p < 0.5f ? 0f : 1f;
            return p < 0.5f ? 1f : 0f;
        }
        return 1f;
    }

    /**
     * Alpha for the first Media3 sequence. DefaultVideoCompositor draws that source on top,
     * so the outgoing clip has to fade here or the incoming clip stays hidden underneath.
     */
    public static float primaryOverlayAlpha(String type, float progress, boolean overlayIncoming) {
        return overlayAlpha(type, progress, !overlayIncoming);
    }

    /**
     * Alpha for the second sequence, drawn underneath. Dissolve keeps it opaque so Porter-Duff
     * over of the fading primary is a linear mix. Fade-through uses the incoming switch.
     */
    public static float secondaryOverlayAlpha(String type, float progress, boolean overlayIncoming) {
        if ("dissolve".equals(type)) return 1f;
        return overlayAlpha(type, progress, overlayIncoming);
    }

    /**
     * RGB scale (0..1) and add (0..1 toward white) for a clip-local fade.
     * {@code incoming} is true on the first overlap of the clip.
     */
    public static float[] rgbFade(String type, float progress, boolean incoming) {
        float p = clamp01(progress);
        float scale = 1f;
        float add = 0f;
        if ("fadeblack".equals(type)) {
            if (incoming) scale = p < 0.5f ? 0f : (p - 0.5f) * 2f;
            else scale = p < 0.5f ? 1f - p * 2f : 0f;
        } else if ("fadewhite".equals(type)) {
            float k;
            if (incoming) k = p < 0.5f ? 1f : (1f - p) * 2f;
            else k = p < 0.5f ? p * 2f : 1f;
            scale = 1f - k;
            add = k;
        }
        return new float[] { clamp01(scale), clamp01(add) };
    }

    /**
     * Whether the overlay pixel at normalized (x, y) stays visible during a wipe.
     * Matches the editor clip-path insets in src/motion.js.
     */
    public static boolean wipeVisible(String type, float x, float y, float progress, boolean overlayIncoming) {
        float p = clamp01(progress);
        boolean incomingVisible;
        switch (type == null ? "" : type) {
            case "wipeleft":
                incomingVisible = x <= p;
                break;
            case "wiperight":
                incomingVisible = x >= 1f - p;
                break;
            case "wipeup":
                incomingVisible = y <= p;
                break;
            case "wipedown":
                incomingVisible = y >= 1f - p;
                break;
            default:
                return true;
        }
        return overlayIncoming ? incomingVisible : !incomingVisible;
    }

    public static float wipeCutoff(String type, float progress) {
        return clamp01(progress);
    }

    public static int wipeMode(String type) {
        if ("wiperight".equals(type)) return 1;
        if ("wipeup".equals(type)) return 2;
        if ("wipedown".equals(type)) return 3;
        return 0;
    }

    /**
     * Media3 draws sequence 0 on top. A gap in that sequence is a tiny black
     * placeholder, not an empty overlay — hide unoccupied inputs between packed clips.
     */
    public static float idleSequenceAlpha(boolean occupied) {
        return occupied ? 1f : 0f;
    }

    public static boolean occupies(int sequence, int inputId, long timeMs, long startMs, long endMs) {
        return sequence == inputId && timeMs >= startMs && timeMs < endMs;
    }

    public static float audioGain(long localUs, long durationUs, long fadeInUs, long fadeOutUs) {
        if (durationUs <= 0) return 1f;
        if (fadeInUs > 0 && localUs < fadeInUs) return clamp01(localUs / (float) fadeInUs);
        if (fadeOutUs > 0 && localUs > durationUs - fadeOutUs) {
            long remain = durationUs - localUs;
            return clamp01(remain / (float) fadeOutUs);
        }
        return 1f;
    }
}
