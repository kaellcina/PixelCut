package com.pixelcut.editor.media;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class TextOverlayMathTest {
    @Test
    public void textIsHiddenOutsideItsTimelineRange() {
        assertEquals(0f, TextOverlayMath.motion("fade", 900_000, 1_000_000, 2_000_000, 400_000).alpha, 0.001f);
        assertEquals(0f, TextOverlayMath.motion("fade", 3_000_000, 1_000_000, 2_000_000, 400_000).alpha, 0.001f);
    }

    @Test
    public void fadeReachesFullOpacityAndLeavesAgain() {
        assertEquals(1f, TextOverlayMath.motion("fade", 1_500_000, 1_000_000, 2_000_000, 400_000).alpha, 0.001f);
        assertEquals(0.578f, TextOverlayMath.motion("fade", 2_900_000, 1_000_000, 2_000_000, 400_000).alpha, 0.01f);
    }

    @Test
    public void slideStartsBelowAndSettlesAtTheRequestedPosition() {
        TextOverlayMath.Motion start = TextOverlayMath.motion("slideUp", 1_000_000, 1_000_000, 2_000_000, 400_000);
        TextOverlayMath.Motion settled = TextOverlayMath.motion("slideUp", 1_500_000, 1_000_000, 2_000_000, 400_000);
        assertEquals(46f, start.dy, 0.001f);
        assertEquals(0f, settled.dy, 0.001f);
    }

    @Test
    public void normalizedEditorCoordinatesBecomeGlAnchors() {
        assertEquals(0f, TextOverlayMath.backgroundAnchorX(0.5f, 0f, 1280), 0.001f);
        assertEquals(0f, TextOverlayMath.backgroundAnchorY(0.5f, 0f, 720), 0.001f);
        assertEquals(-1f, TextOverlayMath.backgroundAnchorX(0f, -200f, 1280), 0.001f);
        assertEquals(-1f, TextOverlayMath.backgroundAnchorY(1f, 200f, 720), 0.001f);
    }

    @Test
    public void typewriterRevealsCharactersWithoutAnEntranceFade() {
        assertEquals(0, TextOverlayMath.typewriterCount("PixelCut", 1_000_000, 1_000_000, 2_000_000, 800_000));
        assertEquals(4, TextOverlayMath.typewriterCount("PixelCut", 1_400_000, 1_000_000, 2_000_000, 800_000));
        assertEquals(8, TextOverlayMath.typewriterCount("PixelCut", 1_800_000, 1_000_000, 2_000_000, 800_000));
        assertEquals(8, TextOverlayMath.typewriterCount("PixelCut", 2_400_000, 1_000_000, 2_000_000, 800_000));
        assertEquals(1f, TextOverlayMath.motion("typewriter", 1_100_000, 1_000_000, 2_000_000, 800_000).alpha, 0.001f);
    }
}
