package com.pixelcut.editor.media;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class ZoomMathTest {
    @Test
    public void zoomUsesTheEditorSmoothstepCurve() {
        assertEquals(1f, ZoomMath.scale(2_000_000, 2_000_000, 1_000_000, 1f, 1.2f), 0.001f);
        assertEquals(1.1f, ZoomMath.scale(2_500_000, 2_000_000, 1_000_000, 1f, 1.2f), 0.001f);
        assertEquals(1.2f, ZoomMath.scale(3_000_000, 2_000_000, 1_000_000, 1f, 1.2f), 0.001f);
    }

    @Test
    public void zoomOutCanRunFromLargeToNormal() {
        assertEquals(1.2f, ZoomMath.scale(0, 0, 2_000_000, 1.2f, 1f), 0.001f);
        assertEquals(1f, ZoomMath.scale(2_500_000, 0, 2_000_000, 1.2f, 1f), 0.001f);
    }

    @Test
    public void zoomNeverShrinksBelowTheFrame() {
        assertEquals(1f, ZoomMath.scale(0, 0, 1_000_000, 0.5f, 0.8f), 0.001f);
    }
}
