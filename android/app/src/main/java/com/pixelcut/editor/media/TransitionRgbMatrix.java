package com.pixelcut.editor.media;

import android.opengl.Matrix;

import androidx.annotation.OptIn;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.effect.RgbMatrix;

@OptIn(markerClass = UnstableApi.class)
final class TransitionRgbMatrix implements RgbMatrix {
    private final String fadeInType;
    private final long fadeInUs;
    private final String fadeOutType;
    private final long fadeOutUs;
    private final long durationUs;
    private final long originUs;
    private final float[] matrix = new float[16];

    TransitionRgbMatrix(String fadeInType, long fadeInUs, String fadeOutType, long fadeOutUs, long durationUs, long originUs) {
        this.fadeInType = fadeInType;
        this.fadeInUs = Math.max(0, fadeInUs);
        this.fadeOutType = fadeOutType;
        this.fadeOutUs = Math.max(0, fadeOutUs);
        this.durationUs = Math.max(1, durationUs);
        this.originUs = Math.max(0, originUs);
    }

    static boolean needed(String fadeInType, long fadeInUs, String fadeOutType, long fadeOutUs) {
        return (fadeInUs > 0 && TransitionMath.isFadeThrough(fadeInType))
            || (fadeOutUs > 0 && TransitionMath.isFadeThrough(fadeOutType));
    }

    @Override
    public float[] getMatrix(long presentationTimeUs, boolean useHdr) {
        Matrix.setIdentityM(matrix, 0);
        long localUs = TransitionMath.clipLocalUs(presentationTimeUs, originUs);
        if (fadeInUs > 0 && localUs >= 0 && localUs < fadeInUs && TransitionMath.isFadeThrough(fadeInType)) {
            apply(fadeInType, localUs / (float) fadeInUs, true);
        } else if (fadeOutUs > 0 && localUs > durationUs - fadeOutUs && TransitionMath.isFadeThrough(fadeOutType)) {
            float progress = (localUs - (durationUs - fadeOutUs)) / (float) fadeOutUs;
            apply(fadeOutType, progress, false);
        }
        return matrix;
    }

    private void apply(String type, float progress, boolean incoming) {
        float[] fade = TransitionMath.rgbFade(type, progress, incoming);
        float scale = fade[0];
        float add = fade[1];
        matrix[0] = scale;
        matrix[5] = scale;
        matrix[10] = scale;
        matrix[12] = add;
        matrix[13] = add;
        matrix[14] = add;
        matrix[15] = 1f;
    }
}
