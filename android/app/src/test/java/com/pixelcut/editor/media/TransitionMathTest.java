package com.pixelcut.editor.media;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class TransitionMathTest {
    @Test
    public void dissolveCrossfadesOverlayAlpha() {
        assertEquals(0f, TransitionMath.overlayAlpha("dissolve", 0f, true), 0.001f);
        assertEquals(0.5f, TransitionMath.overlayAlpha("dissolve", 0.5f, true), 0.001f);
        assertEquals(1f, TransitionMath.overlayAlpha("dissolve", 1f, true), 0.001f);
        assertEquals(1f, TransitionMath.overlayAlpha("dissolve", 0f, false), 0.001f);
        assertEquals(0.5f, TransitionMath.overlayAlpha("dissolve", 0.5f, false), 0.001f);
        assertEquals(0f, TransitionMath.overlayAlpha("dissolve", 1f, false), 0.001f);
    }

    @Test
    public void fadeBlackSwitchesOverlayAtMidpoint() {
        assertEquals(0f, TransitionMath.overlayAlpha("fadeblack", 0.25f, true), 0.001f);
        assertEquals(1f, TransitionMath.overlayAlpha("fadeblack", 0.75f, true), 0.001f);
        assertEquals(1f, TransitionMath.overlayAlpha("fadeblack", 0.25f, false), 0.001f);
        assertEquals(0f, TransitionMath.overlayAlpha("fadeblack", 0.75f, false), 0.001f);
    }

    @Test
    public void fadeBlackRgbGoesThroughBlack() {
        assertEquals(1f, TransitionMath.rgbFade("fadeblack", 0f, false)[0], 0.001f);
        assertEquals(0f, TransitionMath.rgbFade("fadeblack", 0.5f, false)[0], 0.001f);
        assertEquals(0f, TransitionMath.rgbFade("fadeblack", 0.25f, true)[0], 0.001f);
        assertEquals(1f, TransitionMath.rgbFade("fadeblack", 1f, true)[0], 0.001f);
    }

    @Test
    public void wipeLeftRevealsIncomingFromTheLeft() {
        assertTrue(TransitionMath.wipeVisible("wipeleft", 0.2f, 0.5f, 0.4f, true));
        assertFalse(TransitionMath.wipeVisible("wipeleft", 0.8f, 0.5f, 0.4f, true));
        assertFalse(TransitionMath.wipeVisible("wipeleft", 0.2f, 0.5f, 0.4f, false));
        assertTrue(TransitionMath.wipeVisible("wipeleft", 0.8f, 0.5f, 0.4f, false));
    }

    @Test
    public void audioAcrossfadeSumsToOne() {
        long duration = 1_000_000;
        long fade = 200_000;
        float incoming = TransitionMath.audioGain(100_000, duration, fade, 0);
        float outgoing = TransitionMath.audioGain(duration - fade + 100_000, duration, 0, fade);
        assertEquals(0.5f, incoming, 0.001f);
        assertEquals(0.5f, outgoing, 0.001f);
        assertEquals(1f, TransitionMath.audioGain(500_000, duration, fade, fade), 0.001f);
    }

    @Test
    public void hardCutsKeepFullOverlay() {
        assertEquals(1f, TransitionMath.overlayAlpha(null, 0.5f, true), 0.001f);
        assertTrue(TransitionMath.wipeVisible("dissolve", 0.2f, 0.2f, 0.5f, true));
    }
}
