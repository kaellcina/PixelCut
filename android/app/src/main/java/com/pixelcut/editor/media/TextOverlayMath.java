package com.pixelcut.editor.media;

/** Pure timing math for Android text overlays. */
public final class TextOverlayMath {
    public static final class Motion {
        public final float alpha;
        public final float dx;
        public final float dy;
        public final float scale;
        public final float rotation;

        Motion(float alpha, float dx, float dy, float scale, float rotation) {
            this.alpha = alpha;
            this.dx = dx;
            this.dy = dy;
            this.scale = scale;
            this.rotation = rotation;
        }
    }

    private TextOverlayMath() {}

    public static Motion motion(String animation, long timeUs, long startUs, long durationUs, long animationUs) {
        long safeDuration = Math.max(50_000, durationUs);
        long localUs = timeUs - startUs;
        if (localUs < 0 || localUs >= safeDuration) return new Motion(0f, 0f, 0f, 1f, 0f);
        String type = animation == null ? "none" : animation;
        if ("none".equals(type)) return new Motion(1f, 0f, 0f, 1f, 0f);

        long safeAnimation = Math.max(50_000, Math.min(Math.max(50_000, animationUs), safeDuration / 2));
        float tIn = clamp01(localUs / (float) safeAnimation);
        float tOut = clamp01((safeDuration - localUs) / (float) safeAnimation);
        float enter = ("pop".equals(type) || "bounce".equals(type)) ? easeOutBack(tIn) : easeOutCubic(tIn);
        float leave = easeOutCubic(tOut);
        float alpha = Math.min(enter, leave);
        float dx = 0f;
        float dy = 0f;
        float scale = 1f;
        float rotation = 0f;

        switch (type) {
            case "slideUp": dy = (1f - enter) * 46f; break;
            case "slideDown": dy = (1f - enter) * -46f; break;
            case "slideLeft": dx = (1f - enter) * 70f; break;
            case "slideRight": dx = (1f - enter) * -70f; break;
            case "zoom": scale = 0.55f + 0.45f * enter; break;
            case "pop":
                alpha = Math.min(Math.min(1f, tIn * 3f), leave);
                scale = 0.2f + 0.8f * enter;
                break;
            case "bounce":
                dy = (float) (Math.sin(enter * Math.PI) * (1f - enter) * 28f);
                scale = 0.86f + 0.14f * enter;
                break;
            case "rotate":
                rotation = (1f - enter) * -18f;
                scale = 0.85f + 0.15f * enter;
                break;
            case "typewriter": alpha = leave; break;
            case "blurIn": scale = 1.04f - 0.04f * enter; break;
            default: break;
        }
        return new Motion(clamp01(alpha), dx, dy, Math.max(0.05f, scale), rotation);
    }

    public static int typewriterCount(String text, long timeUs, long startUs, long durationUs, long animationUs) {
        int length = text == null ? 0 : text.length();
        if (length == 0 || timeUs < startUs || timeUs >= startUs + Math.max(50_000, durationUs)) return 0;
        long safeAnimation = Math.max(50_000, Math.min(Math.max(50_000, animationUs), Math.max(50_000, durationUs) / 2));
        float progress = clamp01((timeUs - startUs) / (float) safeAnimation);
        return Math.max(0, Math.min(length, Math.round(length * progress)));
    }

    public static float backgroundAnchorX(float normalizedX, float dxPixels, int width) {
        return clampAnchor(normalizedX * 2f - 1f + (2f * dxPixels / Math.max(1, width)));
    }

    public static float backgroundAnchorY(float normalizedY, float dyPixels, int height) {
        return clampAnchor(1f - normalizedY * 2f - (2f * dyPixels / Math.max(1, height)));
    }

    private static float easeOutCubic(float value) {
        float inverse = 1f - clamp01(value);
        return 1f - inverse * inverse * inverse;
    }

    private static float easeOutBack(float value) {
        float t = clamp01(value) - 1f;
        float c1 = 1.70158f;
        float c3 = c1 + 1f;
        return 1f + c3 * t * t * t + c1 * t * t;
    }

    private static float clamp01(float value) {
        return Math.max(0f, Math.min(1f, value));
    }

    private static float clampAnchor(float value) {
        return Math.max(-1f, Math.min(1f, value));
    }
}
