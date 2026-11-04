package com.pixelcut.editor.media;

/** Timing and sizing math for static image overlays. */
public final class ImageOverlayMath {
    public static final class Motion {
        public final float alpha;
        public final float scale;

        Motion(float alpha, float scale) {
            this.alpha = alpha;
            this.scale = scale;
        }
    }

    private ImageOverlayMath() {}

    public static Motion motion(
        long timeUs,
        long startUs,
        long durationUs,
        float opacity,
        float baseScale,
        String enterType,
        long enterUs,
        float enterScale,
        String zoomPreset,
        float zoomFrom,
        float zoomTo,
        long zoomUs
    ) {
        long safeDuration = Math.max(50_000, durationUs);
        long localUs = timeUs - startUs;
        if (localUs < 0 || localUs >= safeDuration) return new Motion(0f, Math.max(0.01f, baseScale));
        float alpha = clamp01(opacity);
        float scale = Math.max(0.01f, baseScale);
        String enter = enterType == null ? "none" : enterType;
        if (!"none".equals(enter)) {
            float progress = smoothstep(localUs / (float) Math.max(50_000, Math.min(enterUs, safeDuration)));
            if ("fade".equals(enter) || "both".equals(enter)) alpha *= progress;
            if ("scale".equals(enter) || "both".equals(enter)) {
                float initial = Math.max(0.05f, Math.min(1f, enterScale));
                scale *= initial + (1f - initial) * progress;
            }
        }
        if (zoomPreset != null && !zoomPreset.isEmpty() && !"none".equals(zoomPreset)) {
            float progress = smoothstep(localUs / (float) Math.max(50_000, Math.min(zoomUs, safeDuration)));
            float from = Math.max(0.01f, zoomFrom);
            float to = Math.max(0.01f, zoomTo);
            scale *= from + (to - from) * progress;
        }
        return new Motion(alpha, scale);
    }

    public static float bitmapScale(float motionScale, int frameWidth, int bitmapWidth) {
        return Math.max(0.001f, motionScale * Math.max(2, frameWidth) * 0.56f / Math.max(1, bitmapWidth));
    }

    private static float smoothstep(float value) {
        float t = clamp01(value);
        return t * t * (3f - 2f * t);
    }

    private static float clamp01(float value) {
        return Math.max(0f, Math.min(1f, value));
    }
}
