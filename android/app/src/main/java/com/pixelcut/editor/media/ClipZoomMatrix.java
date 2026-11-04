package com.pixelcut.editor.media;

import android.opengl.Matrix;

import androidx.annotation.OptIn;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.effect.GlMatrixTransformation;

/** Centered per-clip zoom using the same smoothstep curve as the editor preview. */
@OptIn(markerClass = UnstableApi.class)
final class ClipZoomMatrix implements GlMatrixTransformation {
    private final long originUs;
    private final long durationUs;
    private final float from;
    private final float to;
    private final float[] matrix = new float[16];

    ClipZoomMatrix(long originUs, long durationUs, float from, float to) {
        this.originUs = Math.max(0, originUs);
        this.durationUs = Math.max(50_000, durationUs);
        this.from = Math.max(1f, from);
        this.to = Math.max(1f, to);
    }

    @Override
    public float[] getGlMatrixArray(long presentationTimeUs) {
        Matrix.setIdentityM(matrix, 0);
        float scale = ZoomMath.scale(presentationTimeUs, originUs, durationUs, from, to);
        Matrix.scaleM(matrix, 0, scale, scale, 1f);
        return matrix;
    }

    @Override
    public boolean isNoOp(int inputWidth, int inputHeight) {
        return Math.abs(from - 1f) < 0.001f && Math.abs(to - 1f) < 0.001f;
    }
}
