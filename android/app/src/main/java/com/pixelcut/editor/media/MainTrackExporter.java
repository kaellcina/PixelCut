package com.pixelcut.editor.media;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;

import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.Effect;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.audio.SpeedProvider;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.effect.Brightness;
import androidx.media3.effect.Contrast;
import androidx.media3.effect.GaussianBlur;
import androidx.media3.effect.HslAdjustment;
import androidx.media3.effect.OverlayEffect;
import androidx.media3.effect.Presentation;
import androidx.media3.effect.ScaleAndRotateTransformation;
import androidx.media3.effect.TextureOverlay;
import androidx.media3.transformer.Composition;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.EditedMediaItemSequence;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.ProgressHolder;
import androidx.media3.transformer.Transformer;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Encodes the main-track plan with Media3 Transformer and publishes the MP4
 * through MediaStore. Packed dissolve / fade / wipe use two interleaved
 * sequences and a compositor. Hard cuts stay a single concatenation. Text is
 * applied once at composition level, after the timeline has been assembled.
 */
@OptIn(markerClass = UnstableApi.class)
public final class MainTrackExporter {
    public interface Callback {
        void onProgress(double progress);
        void onSuccess(Uri uri, String display);
        void onFailure(String message);
        void onCanceled();
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean finished = new AtomicBoolean(false);
    private Transformer transformer;
    private File output;
    private volatile boolean canceled;
    private volatile boolean acceptingProgress;
    private int generation;

    public void start(Context context, JSONObject plan, Callback callback) {
        Context app = context.getApplicationContext();
        try {
            Composition composition = composition(app, plan);
            output = new File(app.getCacheDir(), "pixelcut-" + System.currentTimeMillis() + ".mp4");
            if (output.exists() && !output.delete()) {
                callback.onFailure("Não foi possível limpar um arquivo temporário da exportação anterior.");
                return;
            }
            int token = ++generation;
            main.post(() -> run(app, composition, token, callback));
        } catch (Throwable error) {
            callback.onFailure(message(error));
        }
    }

    public void cancel() {
        canceled = true;
        main.post(() -> {
            Transformer active = transformer;
            if (active != null) active.cancel();
        });
    }

    private void run(Context context, Composition composition, int token, Callback callback) {
        if (canceled) {
            finish(callback::onCanceled);
            return;
        }
        try {
            transformer = new Transformer.Builder(context)
                .setVideoMimeType(MimeTypes.VIDEO_H264)
                .setAudioMimeType(MimeTypes.AUDIO_AAC)
                .addListener(new Transformer.Listener() {
                    @Override
                    public void onCompleted(Composition composition, ExportResult exportResult) {
                        acceptingProgress = false;
                        if (canceled) {
                            deleteQuietly(output);
                            finish(callback::onCanceled);
                            return;
                        }
                        publish(context, callback);
                    }

                    @Override
                    public void onError(Composition composition, ExportResult exportResult, ExportException exception) {
                        acceptingProgress = false;
                        deleteQuietly(output);
                        if (canceled) finish(callback::onCanceled);
                        else finish(() -> callback.onFailure(message(exception)));
                    }
                })
                .build();
            acceptingProgress = true;
            transformer.start(composition, output.getAbsolutePath());
            poll(token, callback);
        } catch (Throwable error) {
            deleteQuietly(output);
            finish(() -> callback.onFailure(message(error)));
        }
    }

    private void poll(int token, Callback callback) {
        main.postDelayed(() -> {
            if (!acceptingProgress || token != generation || transformer == null || finished.get()) return;
            ProgressHolder holder = new ProgressHolder();
            int state = transformer.getProgress(holder);
            if (state == Transformer.PROGRESS_STATE_AVAILABLE) callback.onProgress(holder.progress / 100d);
            poll(token, callback);
        }, 300);
    }

    private void publish(Context context, Callback callback) {
        new Thread(() -> {
            if (canceled) {
                deleteQuietly(output);
                main.post(() -> finish(callback::onCanceled));
                return;
            }
            try {
                Published published = writeToMovies(context, output);
                deleteQuietly(output);
                main.post(() -> finish(() -> callback.onSuccess(published.uri, published.display)));
            } catch (Throwable error) {
                deleteQuietly(output);
                String text = message(error);
                main.post(() -> finish(() -> callback.onFailure(text)));
            }
        }, "pixelcut-publish").start();
    }

    private void finish(Runnable action) {
        if (!finished.compareAndSet(false, true)) return;
        generation++;
        transformer = null;
        action.run();
    }

    private static Composition composition(Context context, JSONObject plan) throws IOException, JSONException {
        int width = even(plan.optInt("width", 1280));
        int height = even(plan.optInt("height", 720));
        int fps = Math.min(60, Math.max(1, plan.optInt("fps", 30)));
        JSONArray items = plan.getJSONArray("items");
        if (items.length() == 0) throw new IOException("Adicione um vídeo à faixa principal antes de exportar.");
        JSONArray transitions = plan.optJSONArray("transitions");
        boolean compose = plan.optBoolean("composeOverlaps") && transitions != null && transitions.length() > 0;
        Set<Integer> tracks = new HashSet<>();
        tracks.add(C.TRACK_TYPE_AUDIO);
        tracks.add(C.TRACK_TYPE_VIDEO);
        long timelineMs = plan.optLong("durationMs", 0);
        List<EditedMediaItemSequence> sequences = new ArrayList<>();
        if (!compose) {
            EditedMediaItemSequence.Builder sequence = new EditedMediaItemSequence.Builder(tracks);
            long mainEndMs = 0;
            for (int i = 0; i < items.length(); i++) {
                JSONObject spec = items.getJSONObject(i);
                sequence.addItem(item(context, spec, width, height, fps));
                mainEndMs += spec.optLong("durationMs", 0);
            }
            if (timelineMs > mainEndMs + 1) sequence.addGap(C.msToUs(timelineMs - mainEndMs));
            sequences.add(sequence.build());
            addAudioSequences(context, plan, timelineMs, sequences);
            Composition.Builder composition = new Composition.Builder(sequences);
            addCompositionEffects(context, plan, width, height, composition);
            return composition.build();
        }
        EditedMediaItemSequence.Builder even = new EditedMediaItemSequence.Builder(tracks);
        EditedMediaItemSequence.Builder odd = new EditedMediaItemSequence.Builder(tracks);
        long evenMs = 0;
        long oddMs = 0;
        boolean hasOdd = false;
        for (int i = 0; i < items.length(); i++) {
            JSONObject spec = items.getJSONObject(i);
            long startMs = spec.optLong("startMs", 0);
            boolean overlay = i % 2 == 1;
            EditedMediaItemSequence.Builder sequence = overlay ? odd : even;
            long cursor = overlay ? oddMs : evenMs;
            long gapMs = startMs - cursor;
            if (gapMs > 1) sequence.addGap(C.msToUs(gapMs));
            sequence.addItem(item(context, spec, width, height, fps));
            long endMs = spec.optLong("endMs", startMs + spec.optLong("durationMs"));
            if (overlay) {
                oddMs = endMs;
                hasOdd = true;
            } else {
                evenMs = endMs;
            }
        }
        if (timelineMs <= 0) timelineMs = Math.max(evenMs, oddMs);
        if (evenMs < timelineMs - 1) even.addGap(C.msToUs(timelineMs - evenMs));
        if (oddMs < timelineMs - 1) odd.addGap(C.msToUs(timelineMs - oddMs));
        sequences.add(even.build());
        if (hasOdd) sequences.add(odd.build());
        addAudioSequences(context, plan, timelineMs, sequences);
        Composition.Builder composition = new Composition.Builder(sequences);
        if (hasOdd) composition.setVideoCompositorSettings(new TransitionCompositor(width, height, transitions, items));
        addCompositionEffects(context, plan, width, height, composition);
        return composition.build();
    }

    private static void addCompositionEffects(
        Context context,
        JSONObject plan,
        int width,
        int height,
        Composition.Builder composition
    ) throws IOException, JSONException {
        JSONArray textItems = plan.optJSONArray("textItems");
        JSONArray overlayItems = plan.optJSONArray("overlayItems");
        boolean hasText = textItems != null && textItems.length() > 0;
        boolean hasImages = overlayItems != null && overlayItems.length() > 0;
        if (!hasText && !hasImages) return;
        List<TextureOverlay> overlays = new ArrayList<>();
        appendImageOverlays(context, overlayItems, "behind", width, height, overlays);
        appendTextOverlays(textItems, "behind", width, height, overlays);
        appendImageOverlays(context, overlayItems, "front", width, height, overlays);
        appendTextOverlays(textItems, "front", width, height, overlays);
        if (overlays.isEmpty()) return;
        List<Effect> video = new ArrayList<>();
        video.add(new OverlayEffect(overlays));
        composition.setEffects(new Effects(new ArrayList<>(), video));
    }

    private static void appendTextOverlays(
        JSONArray items,
        String layer,
        int width,
        int height,
        List<TextureOverlay> output
    ) throws JSONException {
        if (items == null) return;
        for (int i = 0; i < items.length(); i++) {
            JSONObject spec = items.getJSONObject(i);
            if (!layer.equals(spec.optString("layer", "front")) || spec.optString("text", "").isEmpty()) continue;
            output.add(new PixelCutTextOverlay(spec, width, height));
        }
    }

    private static void appendImageOverlays(
        Context context,
        JSONArray items,
        String layer,
        int width,
        int height,
        List<TextureOverlay> output
    ) throws IOException, JSONException {
        if (items == null) return;
        for (int i = 0; i < items.length(); i++) {
            JSONObject spec = items.getJSONObject(i);
            if (!layer.equals(spec.optString("layer", "front"))) continue;
            try {
                output.add(new PixelCutImageOverlay(context, spec, width, height));
            } catch (IOException error) {
                String name = spec.optString("name", "imagem");
                throw new IOException("“" + name + "” não pôde ser usada como sobreposição. Importe o arquivo de novo.", error);
            }
        }
    }

    private static void addAudioSequences(
        Context context,
        JSONObject plan,
        long timelineMs,
        List<EditedMediaItemSequence> sequences
    ) throws IOException, JSONException {
        JSONArray audioItems = plan.optJSONArray("audioItems");
        if (audioItems == null) return;
        Set<Integer> audioTrack = new HashSet<>();
        audioTrack.add(C.TRACK_TYPE_AUDIO);
        for (int i = 0; i < audioItems.length(); i++) {
            JSONObject spec = audioItems.getJSONObject(i);
            long startMs = Math.max(0, spec.optLong("startMs", 0));
            long durationMs = Math.max(1, spec.optLong("durationMs", 1));
            EditedMediaItemSequence.Builder sequence = new EditedMediaItemSequence.Builder(audioTrack);
            if (startMs > 0) sequence.addGap(C.msToUs(startMs));
            sequence.addItem(audioItem(context, spec));
            long endMs = startMs + durationMs;
            if (timelineMs > endMs + 1) sequence.addGap(C.msToUs(timelineMs - endMs));
            sequences.add(sequence.build());
        }
    }

    private static EditedMediaItem audioItem(Context context, JSONObject spec) throws IOException, JSONException {
        String name = spec.optString("name", "áudio");
        File file;
        try {
            file = MediaFiles.requireOwned(context, spec.getString("source"));
        } catch (IOException error) {
            throw new IOException("“" + name + "” não está mais no aparelho. Importe o arquivo de novo.");
        }
        long inMs = Math.max(0, Math.round(spec.optDouble("inMs", 0)));
        long outMs = Math.round(spec.optDouble("outMs", 0));
        if (outMs <= inMs) throw new IOException("“" + name + "” tem um corte de áudio inválido.");
        MediaItem media = new MediaItem.Builder()
            .setUri(Uri.fromFile(file))
            .setClippingConfiguration(new MediaItem.ClippingConfiguration.Builder()
                .setStartPositionMs(inMs)
                .setEndPositionMs(outMs)
                .build())
            .build();
        long durationUs = C.msToUs(Math.max(1, spec.optLong("durationMs", 1)));
        long fadeInUs = C.msToUs(Math.max(0, spec.optLong("fadeInMs", 0)));
        long fadeOutUs = C.msToUs(Math.max(0, spec.optLong("fadeOutMs", 0)));
        float audioGain = (float) spec.optDouble("audioGain", 1d);
        List<AudioProcessor> audio = new ArrayList<>();
        if (fadeInUs > 0 || fadeOutUs > 0 || Math.abs(audioGain - 1f) > 0.001f) {
            audio.add(new TransitionGainProcessor(fadeInUs, fadeOutUs, durationUs, audioGain));
        }
        EditedMediaItem.Builder edited = new EditedMediaItem.Builder(media)
            .setRemoveVideo(true)
            .setEffects(new Effects(audio, new ArrayList<>()));
        double speed = spec.optDouble("speed", 1d);
        if (speed > 0.1d && Math.abs(speed - 1d) > 0.001d) edited.setSpeed(constantSpeed((float) speed));
        return edited.build();
    }

    private static EditedMediaItem item(Context context, JSONObject spec, int width, int height, int fps) throws IOException, JSONException {
        String name = spec.optString("name", "mídia");
        File file;
        try {
            file = MediaFiles.requireOwned(context, spec.getString("source"));
        } catch (IOException error) {
            throw new IOException("“" + name + "” não está mais no aparelho. Importe o arquivo de novo.");
        }
        String type = spec.optString("type", "video");
        MediaItem.Builder media = new MediaItem.Builder().setUri(Uri.fromFile(file));
        Effects effects = itemEffects(spec, width, height);
        if ("image".equals(type)) {
            long durationMs = Math.max(1, Math.round(spec.optDouble("durationMs", 0)));
            media.setImageDurationMs(durationMs);
            return new EditedMediaItem.Builder(media.build()).setEffects(effects).setFrameRate(fps).build();
        }
        if (!"video".equals(type)) throw new IOException("“" + name + "” não pode ir para a faixa principal.");
        long inMs = Math.max(0, Math.round(spec.optDouble("inMs", 0)));
        long outMs = Math.round(spec.optDouble("outMs", 0));
        if (outMs <= inMs) throw new IOException("“" + name + "” tem um corte inválido.");
        media.setClippingConfiguration(new MediaItem.ClippingConfiguration.Builder()
            .setStartPositionMs(inMs)
            .setEndPositionMs(outMs)
            .build());
        double speed = spec.optDouble("speed", 1);
        EditedMediaItem.Builder edited = new EditedMediaItem.Builder(media.build())
            .setEffects(effects)
            .setFrameRate(fps)
            .setRemoveAudio(!spec.optBoolean("keepAudio", false));
        if (speed > 0.1 && Math.abs(speed - 1) > 0.001) edited.setSpeed(constantSpeed((float) speed));
        return edited.build();
    }

    private static Effects itemEffects(JSONObject spec, int width, int height) {
        List<Effect> video = new ArrayList<>();
        long durationUs = C.msToUs(Math.max(1, spec.optLong("durationMs")));
        long originUs = C.msToUs(Math.max(0, spec.optLong("startMs")));
        appendVisualEffects(spec.optJSONArray("visualEffects"), video);
        String zoomPreset = spec.optString("zoomPreset", "none");
        if (!zoomPreset.isEmpty() && !"none".equals(zoomPreset)) {
            video.add(new ClipZoomMatrix(
                originUs,
                C.msToUs(Math.max(50, spec.optLong("zoomDurationMs", 1000))),
                (float) spec.optDouble("zoomFrom", 1d),
                (float) spec.optDouble("zoomTo", 1d)
            ));
        }
        video.add(Presentation.createForWidthAndHeight(width, height, Presentation.LAYOUT_SCALE_TO_FIT));
        long fadeInUs = C.msToUs(spec.optLong("fadeInMs", spec.optLong("overlapMs")));
        long fadeOutUs = C.msToUs(spec.optLong("fadeOutMs"));
        String fadeInType = spec.optString("fadeInType", spec.optString("transition"));
        String fadeOutType = spec.optString("fadeOutType");
        if (TransitionRgbMatrix.needed(fadeInType, fadeInUs, fadeOutType, fadeOutUs)) {
            video.add(new TransitionRgbMatrix(fadeInType, fadeInUs, fadeOutType, fadeOutUs, durationUs, originUs));
        }
        // DefaultVideoCompositor draws the first sequence on top. Punch wipe holes there
        // so the other clip shows through; the bottom sequence stays opaque.
        if (spec.optInt("sequence", 0) == 0) {
            List<TransitionWipeEffect.Window> wipes = new ArrayList<>();
            if (TransitionMath.isWipe(fadeInType) && fadeInUs > 0) {
                wipes.add(new TransitionWipeEffect.Window(fadeInType, originUs, originUs + fadeInUs, true));
            }
            if (TransitionMath.isWipe(fadeOutType) && fadeOutUs > 0) {
                long start = originUs + Math.max(0, durationUs - fadeOutUs);
                wipes.add(new TransitionWipeEffect.Window(fadeOutType, start, originUs + durationUs, false));
            }
            if (!wipes.isEmpty()) video.add(new TransitionWipeEffect(wipes));
        }
        List<AudioProcessor> audio = new ArrayList<>();
        float audioGain = (float) spec.optDouble("audioGain", 1d);
        if (spec.optBoolean("keepAudio", false)
            && (fadeInUs > 0 || fadeOutUs > 0 || Math.abs(audioGain - 1f) > 0.001f)) {
            audio.add(new TransitionGainProcessor(fadeInUs, fadeOutUs, durationUs, audioGain));
        }
        return new Effects(audio, video);
    }

    private static void appendVisualEffects(JSONArray specs, List<Effect> output) {
        if (specs == null) return;
        for (int i = 0; i < specs.length(); i++) {
            JSONObject spec = specs.optJSONObject(i);
            if (spec == null) continue;
            String type = spec.optString("type", "");
            if ("brightness".equals(type)) {
                output.add(new Brightness((float) spec.optDouble("amount", 0d)));
            } else if ("contrast".equals(type)) {
                output.add(new Contrast((float) spec.optDouble("amount", 0d)));
            } else if ("blur".equals(type)) {
                output.add(new GaussianBlur(Math.max(0.2f, (float) spec.optDouble("sigma", 0.2d))));
            } else if ("hsl".equals(type)) {
                output.add(new HslAdjustment.Builder()
                    .adjustHue((float) spec.optDouble("hue", 0d))
                    .adjustSaturation((float) spec.optDouble("saturation", 0d))
                    .adjustLightness((float) spec.optDouble("lightness", 0d))
                    .build());
            } else if ("mirror".equals(type)) {
                output.add(new ScaleAndRotateTransformation.Builder().setScale(-1f, 1f).build());
            }
        }
    }

    private static SpeedProvider constantSpeed(float speed) {
        return new SpeedProvider() {
            @Override
            public float getSpeed(long timeUs) {
                return speed;
            }

            @Override
            public long getNextSpeedChangeTimeUs(long timeUs) {
                return C.TIME_UNSET;
            }
        };
    }

    private static Published writeToMovies(Context context, File file) throws IOException {
        if (file == null || !file.isFile() || file.length() == 0) {
            throw new IOException("O codificador não gerou um MP4.");
        }
        String name = "PixelCut-" + new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(new Date()) + ".mp4";
        String display = "Movies/PixelCut/" + name;
        ContentResolver resolver = context.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Video.Media.DISPLAY_NAME, name);
        values.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
        Uri collection;
        if (Build.VERSION.SDK_INT >= 29) {
            values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/PixelCut");
            values.put(MediaStore.Video.Media.IS_PENDING, 1);
            collection = MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        } else {
            File movies = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES), "PixelCut");
            if (!movies.exists() && !movies.mkdirs()) throw new IOException("Não foi possível criar Filmes/PixelCut.");
            File dest = new File(movies, name);
            copyFile(file, dest);
            values.put(MediaStore.MediaColumns.DATA, dest.getAbsolutePath());
            collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
            Uri inserted = resolver.insert(collection, values);
            if (inserted == null) {
                dest.delete();
                throw new IOException("Não foi possível gravar o vídeo em Filmes/PixelCut.");
            }
            return new Published(inserted, display);
        }
        Uri uri = resolver.insert(collection, values);
        if (uri == null) throw new IOException("Não foi possível gravar o vídeo em Filmes/PixelCut.");
        if (Build.VERSION.SDK_INT >= 29) {
            try (OutputStream output = resolver.openOutputStream(uri)) {
                if (output == null) throw new IOException("Não foi possível gravar o vídeo em Filmes/PixelCut.");
                copyStream(file, output);
            } catch (IOException error) {
                resolver.delete(uri, null, null);
                if (isSpace(error)) throw new IOException("Não há espaço livre suficiente para gravar o vídeo.");
                throw new IOException("Não foi possível gravar o vídeo em Filmes/PixelCut.");
            }
            ContentValues ready = new ContentValues();
            ready.put(MediaStore.Video.Media.IS_PENDING, 0);
            resolver.update(uri, ready, null, null);
        }
        return new Published(uri, display);
    }

    private static void copyFile(File source, File dest) throws IOException {
        try (OutputStream output = new java.io.FileOutputStream(dest)) {
            copyStream(source, output);
        } catch (IOException error) {
            dest.delete();
            if (isSpace(error)) throw new IOException("Não há espaço livre suficiente para gravar o vídeo.");
            throw error;
        }
    }

    private static void copyStream(File source, OutputStream output) throws IOException {
        try (InputStream input = new FileInputStream(source)) {
            byte[] buffer = new byte[1024 * 1024];
            int read;
            while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read);
        }
    }

    private static boolean isSpace(IOException error) {
        String message = error.getMessage() == null ? "" : error.getMessage().toLowerCase(Locale.US);
        return message.contains("enospc") || message.contains("no space") || message.contains("espaço");
    }

    private static int even(int value) {
        int n = Math.max(2, value);
        return n % 2 == 0 ? n : n - 1;
    }

    private static void deleteQuietly(File file) {
        if (file != null && file.exists()) file.delete();
    }

    private static String message(Throwable error) {
        if (error instanceof OutOfMemoryError) return "A memória do aparelho não foi suficiente para exportar este vídeo.";
        String text = error.getMessage();
        if (text == null || text.trim().isEmpty()) return "Não foi possível codificar o vídeo.";
        if (text.startsWith("“") || text.startsWith("Não") || text.startsWith("O ") || text.startsWith("Adicione") || text.startsWith("Um ") || text.startsWith("A ")) {
            return text;
        }
        return "Não foi possível codificar o vídeo. " + text;
    }

    private static final class Published {
        final Uri uri;
        final String display;

        Published(Uri uri, String display) {
            this.uri = uri;
            this.display = display;
        }
    }
}
