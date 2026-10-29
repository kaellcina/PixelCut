package com.pixelcut.editor.media;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class MediaFilesUnwrapTest {
    @Test
    public void unwrapsCapacitorPlaybackUrl() {
        String raw = "https://localhost/_capacitor_file_/data/user/0/com.pixelcut.editor/files/media/a.mp4";
        assertEquals("/data/user/0/com.pixelcut.editor/files/media/a.mp4", MediaFiles.unwrapSource(raw));
    }

    @Test
    public void keepsOwnedAbsolutePath() {
        String raw = "/data/user/0/com.pixelcut.editor/files/media/a.mp4";
        assertEquals(raw, MediaFiles.unwrapSource(raw));
    }

    @Test
    public void dropsBareHttpAndContentUris() {
        assertEquals("", MediaFiles.unwrapSource("https://example.com/video.mp4"));
        assertEquals("", MediaFiles.unwrapSource("content://media/external/video/media/12"));
        assertEquals("", MediaFiles.unwrapSource(null));
        assertEquals("", MediaFiles.unwrapSource(""));
    }
}
