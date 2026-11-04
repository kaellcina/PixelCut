package com.pixelcut.editor.media;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class ImageOverlayMathTest {
    @Test
    public void overlayIsHiddenOutsideItsRange() {
        assertEquals(0f, motion(500_000).alpha, 0.001f);
        assertEquals(0f, motion(4_000_000).alpha, 0.001f);
    }

    @Test
    public void fadeAndScaleEntranceSettleToClipValues() {
        ImageOverlayMath.Motion start = motion(1_000_000);
        ImageOverlayMath.Motion settled = motion(2_000_000);
        assertEquals(0f, start.alpha, 0.001f);
        assertEquals(0.8f, start.scale, 0.001f);
        assertEquals(0.5f, settled.alpha, 0.001f);
        assertEquals(1f, settled.scale, 0.001f);
    }

    @Test
    public void editorScaleUsesFiftySixPercentFrameWidth() {
        assertEquals(1.12f, ImageOverlayMath.bitmapScale(1f, 1000, 500), 0.001f);
    }

    private static ImageOverlayMath.Motion motion(long timeUs) {
        return ImageOverlayMath.motion(
            timeUs, 1_000_000, 3_000_000, 0.5f, 1f,
            "both", 500_000, 0.8f, "none", 1f, 1f, 1_000_000
        );
    }
}
