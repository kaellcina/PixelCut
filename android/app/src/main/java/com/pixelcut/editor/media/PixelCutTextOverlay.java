package com.pixelcut.editor.media;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;

import androidx.media3.common.OverlaySettings;
import androidx.media3.effect.BitmapOverlay;
import androidx.media3.effect.StaticOverlaySettings;

import org.json.JSONObject;

import java.util.Locale;

/** A small, cached text bitmap whose position and entrance animation follow the project timeline. */
final class PixelCutTextOverlay extends BitmapOverlay {
    private Bitmap bitmap;
    private final JSONObject spec;
    private final String fullText;
    private final boolean typewriter;
    private final long startUs;
    private final long durationUs;
    private final long animationUs;
    private final String animation;
    private final float x;
    private final float y;
    private final int frameWidth;
    private final int frameHeight;
    private int lastTypewriterCount;

    PixelCutTextOverlay(JSONObject spec, int frameWidth, int frameHeight) {
        this.spec = spec;
        this.frameWidth = Math.max(2, frameWidth);
        this.frameHeight = Math.max(2, frameHeight);
        startUs = Math.max(0, spec.optLong("startMs", 0)) * 1000L;
        durationUs = Math.max(50, spec.optLong("durationMs", 50)) * 1000L;
        animationUs = Math.max(50, spec.optLong("animationDurationMs", 450)) * 1000L;
        animation = spec.optString("animation", "none");
        fullText = spec.optString("text", "");
        typewriter = "typewriter".equals(animation);
        x = clamp01((float) spec.optDouble("x", 0.5d));
        y = clamp01((float) spec.optDouble("y", 0.85d));
        lastTypewriterCount = typewriter ? 0 : fullText.length();
        bitmap = render(spec, typewriter ? "" : fullText, fullText, null);
    }

    @Override
    public Bitmap getBitmap(long presentationTimeUs) {
        if (typewriter) {
            int count = TextOverlayMath.typewriterCount(fullText, presentationTimeUs, startUs, durationUs, animationUs);
            if (count != lastTypewriterCount) {
                lastTypewriterCount = count;
                // Media3 may still be uploading the bitmap returned for the previous frame.
                // Keep every revealed state immutable instead of redrawing that shared object.
                bitmap = render(spec, fullText.substring(0, count), fullText, null);
            }
        }
        return bitmap;
    }

    @Override
    public OverlaySettings getOverlaySettings(long presentationTimeUs) {
        TextOverlayMath.Motion motion = TextOverlayMath.motion(
            animation,
            presentationTimeUs,
            startUs,
            durationUs,
            animationUs
        );
        return new StaticOverlaySettings.Builder()
            .setAlphaScale(motion.alpha)
            .setBackgroundFrameAnchor(
                TextOverlayMath.backgroundAnchorX(x, motion.dx, frameWidth),
                TextOverlayMath.backgroundAnchorY(y, motion.dy, frameHeight)
            )
            .setOverlayFrameAnchor(0f, 0f)
            .setScale(motion.scale, motion.scale)
            .setRotationDegrees(motion.rotation)
            .build();
    }

    private static Bitmap render(JSONObject spec, String displayValue, String measureValue, Bitmap target) {
        String measured = measureValue == null || measureValue.isEmpty() ? " " : measureValue;
        String shown = displayValue == null ? "" : displayValue;
        String[] layoutLines = measured.split("\\n", -1);
        String[] displayLines = shown.split("\\n", -1);
        float size = Math.max(8f, Math.min(512f, (float) spec.optDouble("size", 48d)));
        float strokeWidth = Math.max(1f, Math.min(24f, (float) spec.optDouble("strokeWidth", 2d)));
        String effect = spec.optString("letterEffect", "outline");
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
        paint.setTextSize(size);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTypeface(typeface(spec.optString("font", "montserrat"), spec.optBoolean("bold", true), spec.optBoolean("italic", false)));
        if ("spacious".equals(effect)) paint.setLetterSpacing(0.16f);

        float widest = 1f;
        for (String line : layoutLines) widest = Math.max(widest, paint.measureText(line.isEmpty() ? " " : line));
        Paint.FontMetrics metrics = paint.getFontMetrics();
        float lineHeight = Math.max(size, (metrics.descent - metrics.ascent) * 1.08f);
        float effectPad = ("glow".equals(effect) || "neon".equals(effect)) ? size * 0.45f : size * 0.18f;
        float boxPadX = "background".equals(effect) ? size * 0.42f : 0f;
        float boxPadY = "background".equals(effect) ? size * 0.12f : 0f;
        float pad = Math.max(8f, Math.max(effectPad, strokeWidth * 3f + 6f));
        int width = Math.max(2, (int) Math.ceil(widest + (pad + boxPadX) * 2f));
        int height = Math.max(2, (int) Math.ceil(layoutLines.length * lineHeight + (pad + boxPadY) * 2f));
        Bitmap output = target;
        if (output == null || output.getWidth() != width || output.getHeight() != height) {
            output = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        } else {
            output.eraseColor(Color.TRANSPARENT);
        }
        Canvas canvas = new Canvas(output);
        float centerX = width / 2f;
        float contentTop = pad + boxPadY;

        if ("background".equals(effect)) {
            Paint box = new Paint(Paint.ANTI_ALIAS_FLAG);
            box.setColor(cssColor(spec.optString("backgroundColor", "rgba(0,0,0,0.72)"), 0xB8000000));
            canvas.drawRoundRect(
                new RectF(pad, pad, width - pad, height - pad),
                Math.max(4f, size * 0.14f),
                Math.max(4f, size * 0.14f),
                box
            );
        }

        int fill = cssColor(spec.optString("color", "#ffffff"), Color.WHITE);
        int stroke = cssColor(spec.optString("strokeColor", "#000000"), Color.BLACK);
        int shadow = cssColor(spec.optString("shadowColor", "#000000"), Color.BLACK);
        for (int index = 0; index < displayLines.length; index++) {
            String line = displayLines[index];
            if (line.isEmpty()) continue;
            float baseline = contentTop + index * lineHeight - metrics.ascent;
            drawStyled(canvas, paint, line, centerX, baseline, effect, fill, stroke, shadow, strokeWidth, size);
        }
        return output;
    }

    private static void drawStyled(
        Canvas canvas,
        Paint paint,
        String text,
        float x,
        float baseline,
        String effect,
        int fill,
        int stroke,
        int shadow,
        float strokeWidth,
        float size
    ) {
        paint.clearShadowLayer();
        if ("shadow".equals(effect)) paint.setShadowLayer(1f, 3f, 3f, shadow);
        if ("glow".equals(effect) || "neon".equals(effect)) paint.setShadowLayer(size * 0.18f, 0f, 0f, fill);
        if ("3d".equals(effect)) paint.setShadowLayer(size * 0.12f, 4f, 4f, shadow);
        if ("double".equals(effect)) paint.setShadowLayer(1f, 4f, 4f, shadow);
        if ("sticker".equals(effect)) paint.setShadowLayer(1f, 0f, 3f, Color.BLACK);

        boolean hollow = "hollow".equals(effect);
        boolean outlined = "outline".equals(effect) || "thick".equals(effect) || "double".equals(effect) || "sticker".equals(effect) || hollow;
        if (outlined) {
            float width = strokeWidth;
            int outlineColor = stroke;
            if ("thick".equals(effect) || "double".equals(effect)) width = Math.max(4f, strokeWidth + 2f);
            if ("sticker".equals(effect)) {
                width = Math.max(5f, strokeWidth + 3f);
                outlineColor = Color.WHITE;
            }
            if (hollow) {
                width = Math.max(2f, strokeWidth);
                outlineColor = fill;
            }
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(width * 2f);
            paint.setColor(outlineColor);
            canvas.drawText(text, x, baseline, paint);
        }
        if (!hollow) {
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(fill);
            canvas.drawText(text, x, baseline, paint);
        }
        paint.clearShadowLayer();
    }

    private static Typeface typeface(String font, boolean bold, boolean italic) {
        String id = font == null ? "" : font.toLowerCase(Locale.ROOT);
        String family;
        if (id.matches("playfair|georgia|times|gabriola")) family = "serif";
        else if (id.matches("courier|consolas")) family = "monospace";
        else if (id.matches("pacifico|dancing|comic|script|ink")) family = "cursive";
        else if (id.matches("oswald|anton|bebas|impact")) family = "sans-serif-condensed";
        else family = "sans-serif";
        int style = (bold ? Typeface.BOLD : Typeface.NORMAL) | (italic ? Typeface.ITALIC : Typeface.NORMAL);
        return Typeface.create(family, style);
    }

    private static int cssColor(String value, int fallback) {
        try {
            String color = value == null ? "" : value.trim();
            if (color.toLowerCase(Locale.ROOT).startsWith("rgba(")) {
                String[] values = color.substring(5, color.length() - 1).split(",");
                if (values.length == 4) {
                    int r = Math.round(Float.parseFloat(values[0].trim()));
                    int g = Math.round(Float.parseFloat(values[1].trim()));
                    int b = Math.round(Float.parseFloat(values[2].trim()));
                    int a = Math.round(Float.parseFloat(values[3].trim()) * 255f);
                    return Color.argb(clamp255(a), clamp255(r), clamp255(g), clamp255(b));
                }
            }
            return Color.parseColor(color);
        } catch (Throwable ignored) {
            return fallback;
        }
    }

    private static int clamp255(int value) {
        return Math.max(0, Math.min(255, value));
    }

    private static float clamp01(float value) {
        return Math.max(0f, Math.min(1f, value));
    }
}
