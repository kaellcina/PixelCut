package com.pixelcut.editor.media;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import androidx.media3.common.OverlaySettings;
import androidx.media3.effect.BitmapOverlay;
import androidx.media3.effect.StaticOverlaySettings;

import org.json.JSONObject;

import java.io.File;
import java.io.IOException;

/** Cached image overlay with timeline-aware opacity, entrance and zoom. */
final class PixelCutImageOverlay extends BitmapOverlay {
    private final Bitmap bitmap;
    private final long startUs;
    private final long durationUs;
    private final float x;
    private final float y;
    private final float opacity;
    private final float baseScale;
    private final String enterType;
    private final long enterUs;
    private final float enterScale;
    private final String zoomPreset;
    private final float zoomFrom;
    private final float zoomTo;
    private final long zoomUs;
    private final int frameWidth;
    private final int frameHeight;

    PixelCutImageOverlay(Context context, JSONObject spec, int frameWidth, int frameHeight) throws IOException {
        this.frameWidth = Math.max(2, frameWidth);
        this.frameHeight = Math.max(2, frameHeight);
        String source = spec.optString("source", "");
        if (source.isEmpty()) throw new IOException("A imagem de sobreposição não tem um arquivo salvo.");
        File file = MediaFiles.requireOwned(context, source);
        bitmap = decode(file, this.frameWidth, this.frameHeight);
        startUs = Math.max(0, spec.optLong("startMs", 0)) * 1000L;
        durationUs = Math.max(50, spec.optLong("durationMs", 50)) * 1000L;
        x = clamp01((float) spec.optDouble("x", 0.5d));
        y = clamp01((float) spec.optDouble("y", 0.5d));
        opacity = clamp01((float) spec.optDouble("opacity", 1d));
        baseScale = Math.max(0.01f, (float) spec.optDouble("scale", 1d));
        enterType = spec.optString("enterType", "none");
        enterUs = Math.max(50, spec.optLong("enterDurationMs", 600)) * 1000L;
        enterScale = Math.max(0.05f, (float) spec.optDouble("enterScale", 0.85d));
        zoomPreset = spec.optString("zoomPreset", "none");
        zoomFrom = Math.max(0.01f, (float) spec.optDouble("zoomFrom", 1d));
        zoomTo = Math.max(0.01f, (float) spec.optDouble("zoomTo", zoomFrom));
        zoomUs = Math.max(50, spec.optLong("zoomDurationMs", 1000)) * 1000L;
    }

    @Override
    public Bitmap getBitmap(long presentationTimeUs) {
        return bitmap;
    }

    @Override
    public OverlaySettings getOverlaySettings(long presentationTimeUs) {
        ImageOverlayMath.Motion motion = ImageOverlayMath.motion(
            presentationTimeUs, startUs, durationUs, opacity, baseScale,
            enterType, enterUs, enterScale, zoomPreset, zoomFrom, zoomTo, zoomUs
        );
        float scale = ImageOverlayMath.bitmapScale(motion.scale, frameWidth, bitmap.getWidth());
        return new StaticOverlaySettings.Builder()
            .setAlphaScale(motion.alpha)
            .setBackgroundFrameAnchor(
                TextOverlayMath.backgroundAnchorX(x, 0f, frameWidth),
                TextOverlayMath.backgroundAnchorY(y, 0f, frameHeight)
            )
            .setOverlayFrameAnchor(0f, 0f)
            .setScale(scale, scale)
            .build();
    }

    private static Bitmap decode(File file, int frameWidth, int frameHeight) throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(file.getAbsolutePath(), bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IOException("A imagem de sobreposição não pôde ser lida.");
        int maxWidth = Math.max(512, frameWidth * 2);
        int maxHeight = Math.max(512, frameHeight * 2);
        int sample = 1;
        while (bounds.outWidth / (sample * 2) >= maxWidth || bounds.outHeight / (sample * 2) >= maxHeight) sample *= 2;
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample;
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        Bitmap decoded = BitmapFactory.decodeFile(file.getAbsolutePath(), options);
        if (decoded == null) throw new IOException("A imagem de sobreposição não pôde ser decodificada.");
        return decoded;
    }

    private static float clamp01(float value) {
        return Math.max(0f, Math.min(1f, value));
    }
}
