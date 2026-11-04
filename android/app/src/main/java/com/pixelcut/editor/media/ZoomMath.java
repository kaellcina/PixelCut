package com.pixelcut.editor.media;

/** Pure zoom curve shared by the Media3 matrix effect and JVM tests. */
public final class ZoomMath {
    private ZoomMath() {}

    public static float scale(long presentationTimeUs, long originUs, long durationUs, float from, float to) {
        long localUs = Math.max(0, presentationTimeUs - Math.max(0, originUs));
        long safeDuration = Math.max(50_000, durationUs);
        float t = Math.max(0f, Math.min(1f, localUs / (float) safeDuration));
        float smooth = t * t * (3f - 2f * t);
        float safeFrom = Math.max(1f, from);
        float safeTo = Math.max(1f, to);
        return safeFrom + (safeTo - safeFrom) * smooth;
    }
}
