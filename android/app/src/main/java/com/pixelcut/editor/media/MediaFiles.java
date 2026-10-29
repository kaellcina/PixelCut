package com.pixelcut.editor.media;

import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.graphics.BitmapFactory;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.util.Locale;
import java.util.UUID;

/** Copies picked media into the app's private storage and checks those copies later. */
public final class MediaFiles {
    private static final int BUFFER = 1024 * 1024;

    private MediaFiles() {}

    public static File mediaDir(Context context) {
        File dir = new File(context.getFilesDir(), "media");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Não foi possível criar a pasta privada de mídia.");
        }
        return dir;
    }

    public static String unwrapSource(String raw) {
        if (raw == null) return "";
        String value = raw.trim();
        if (value.isEmpty()) return "";
        String[] markers = new String[] {"/_capacitor_file_", "/_capacitor_content_"};
        for (String marker : markers) {
            int at = value.indexOf(marker);
            if (at >= 0) {
                String rest = value.substring(at + marker.length());
                try {
                    rest = URLDecoder.decode(rest, "UTF-8");
                } catch (UnsupportedEncodingException | IllegalArgumentException ignored) {
                    // Keep the raw suffix when it is not percent-encoded.
                }
                if (rest.startsWith("file:")) return unwrapSource(rest);
                if (!rest.isEmpty() && !rest.startsWith("/")) rest = "/" + rest;
                return rest;
            }
        }
        if (value.startsWith("file:")) {
            Uri uri = Uri.parse(value);
            String path = uri.getPath();
            return path == null || path.isEmpty() ? value.replaceFirst("^file://", "") : path;
        }
        if (value.startsWith("content:") || value.startsWith("http:") || value.startsWith("https:") || value.startsWith("capacitor:")) {
            return "";
        }
        return value;
    }

    public static File requireOwned(Context context, String source) throws IOException {
        String path = unwrapSource(source);
        if (path == null || path.trim().isEmpty()) {
            throw new IOException("Um clipe não tem arquivo salvo. Importe a mídia de novo.");
        }
        File file = new File(path);
        File root = mediaDir(context);
        String canonical = file.getCanonicalPath();
        String owned = root.getCanonicalPath();
        if (!canonical.startsWith(owned + File.separator)) {
            throw new IOException("A mídia precisa estar na pasta privada do PixelCut. Importe o arquivo de novo.");
        }
        if (!file.isFile()) {
            throw new IOException("O arquivo não está mais no aparelho. Localize a mídia de novo; o clipe permanece no projeto.");
        }
        return file;
    }

    public static File findOwned(Context context, String source) {
        try {
            return requireOwned(context, source);
        } catch (IOException error) {
            return null;
        }
    }

    public static boolean exists(Context context, String source) {
        File file = findOwned(context, source);
        return file != null && file.isFile();
    }

    public static boolean deleteOwned(Context context, String source) {
        try {
            File file = requireOwned(context, source);
            return !file.exists() || file.delete();
        } catch (IOException error) {
            return false;
        }
    }

    public static CopiedMedia copy(Context context, Uri uri) throws IOException {
        ContentResolver resolver = context.getContentResolver();
        String name = displayName(resolver, uri);
        String mime = resolver.getType(uri);
        if (mime == null) mime = guessMime(name);
        String type = kind(mime);
        if (type == null) {
            throw new IOException("Formato não suportado. Use vídeo, imagem ou áudio.");
        }
        long size = sizeOf(resolver, uri);
        File dir = mediaDir(context);
        ensureSpace(dir, size);
        File dest = new File(dir, UUID.randomUUID() + extension(name, mime));
        try (InputStream input = resolver.openInputStream(uri)) {
            if (input == null) throw new IOException("A permissão para ler este arquivo foi recusada. Escolha o arquivo de novo.");
            try (OutputStream output = new FileOutputStream(dest)) {
                byte[] buffer = new byte[BUFFER];
                int read;
                while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read);
            }
        } catch (SecurityException error) {
            dest.delete();
            throw new IOException("A permissão para ler este arquivo foi recusada. Escolha o arquivo de novo.");
        } catch (IOException error) {
            dest.delete();
            if (isSpace(error)) throw new IOException("Não há espaço livre suficiente para copiar este arquivo.");
            throw error;
        }
        try {
            return describe(dest, name, type);
        } catch (IOException error) {
            dest.delete();
            throw error;
        }
    }

    private static CopiedMedia describe(File file, String name, String type) throws IOException {
        if ("image".equals(type)) {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(file.getAbsolutePath(), bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
                throw new IOException("Não foi possível ler esta imagem.");
            }
            return new CopiedMedia(name, file.getAbsolutePath(), "image", 5, bounds.outWidth, bounds.outHeight, true, false);
        }
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(file.getAbsolutePath());
            String rawDuration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            double duration = rawDuration == null ? 0 : Long.parseLong(rawDuration) / 1000d;
            if (!(duration > 0)) throw new IOException("Não foi possível ler a duração deste arquivo.");
            int width = number(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH));
            int height = number(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT));
            Tracks tracks = tracks(file);
            if ("video".equals(type) && !tracks.video) throw new IOException("Este arquivo não tem uma faixa de vídeo legível.");
            if ("audio".equals(type)) return new CopiedMedia(name, file.getAbsolutePath(), "audio", duration, 0, 0, false, true);
            return new CopiedMedia(name, file.getAbsolutePath(), "video", duration, width, height, true, tracks.audio);
        } catch (RuntimeException error) {
            throw new IOException("Não foi possível ler este arquivo. Tente um MP4 H.264, uma imagem ou um áudio comum.");
        } finally {
            retriever.release();
        }
    }

    private static Tracks tracks(File file) throws IOException {
        MediaExtractor extractor = new MediaExtractor();
        try {
            extractor.setDataSource(file.getAbsolutePath());
            boolean audio = false;
            boolean video = false;
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat format = extractor.getTrackFormat(i);
                String mime = format.getString(MediaFormat.KEY_MIME);
                if (mime == null) continue;
                if (mime.startsWith("audio/")) audio = true;
                if (mime.startsWith("video/")) video = true;
            }
            return new Tracks(video, audio);
        } finally {
            extractor.release();
        }
    }

    private static void ensureSpace(File dir, long bytes) throws IOException {
        if (bytes <= 0) return;
        long available = dir.getUsableSpace();
        if (available >= 0 && available < bytes + BUFFER) {
            throw new IOException("Não há espaço livre suficiente para copiar este arquivo.");
        }
    }

    private static boolean isSpace(IOException error) {
        String message = error.getMessage() == null ? "" : error.getMessage().toLowerCase(Locale.US);
        return message.contains("enospc") || message.contains("no space") || message.contains("espaço");
    }

    private static String displayName(ContentResolver resolver, Uri uri) {
        try (Cursor cursor = resolver.query(uri, new String[] {OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0 && !cursor.isNull(index)) return cursor.getString(index);
            }
        } catch (SecurityException ignored) {
            // The temporary grant can still open the stream even when the name is hidden.
        }
        return "mídia";
    }

    private static long sizeOf(ContentResolver resolver, Uri uri) {
        try (Cursor cursor = resolver.query(uri, new String[] {OpenableColumns.SIZE}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (index >= 0 && !cursor.isNull(index)) return cursor.getLong(index);
            }
        } catch (SecurityException ignored) {
            return -1;
        }
        return -1;
    }

    private static String kind(String mime) {
        if (mime == null) return null;
        if (mime.startsWith("video/")) return "video";
        if (mime.startsWith("image/")) return "image";
        if (mime.startsWith("audio/")) return "audio";
        return null;
    }

    private static String guessMime(String name) {
        String lower = name == null ? "" : name.toLowerCase(Locale.US);
        if (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".m4v") || lower.endsWith(".webm")) return "video/mp4";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".m4a") || lower.endsWith(".aac")) return "audio/mp4";
        if (lower.endsWith(".wav")) return "audio/wav";
        return null;
    }

    private static String extension(String name, String mime) {
        if (name != null) {
            int dot = name.lastIndexOf('.');
            if (dot > 0 && dot < name.length() - 1) {
                String ext = name.substring(dot).toLowerCase(Locale.US);
                if (ext.matches("\\.[a-z0-9]{1,5}")) return ext;
            }
        }
        if ("image/jpeg".equals(mime)) return ".jpg";
        if ("image/png".equals(mime)) return ".png";
        if ("image/webp".equals(mime)) return ".webp";
        if ("image/gif".equals(mime)) return ".gif";
        if ("audio/mpeg".equals(mime)) return ".mp3";
        if ("audio/wav".equals(mime) || "audio/x-wav".equals(mime)) return ".wav";
        if (mime != null && mime.startsWith("audio/")) return ".m4a";
        if (mime != null && mime.startsWith("image/")) return ".img";
        return ".mp4";
    }

    private static int number(String value) {
        if (value == null) return 0;
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException error) {
            return 0;
        }
    }

    public static final class CopiedMedia {
        public final String name;
        public final String source;
        public final String type;
        public final double duration;
        public final int width;
        public final int height;
        public final boolean hasVideo;
        public final boolean hasAudio;

        CopiedMedia(String name, String source, String type, double duration, int width, int height, boolean hasVideo, boolean hasAudio) {
            this.name = name;
            this.source = source;
            this.type = type;
            this.duration = duration;
            this.width = width;
            this.height = height;
            this.hasVideo = hasVideo;
            this.hasAudio = hasAudio;
        }
    }

    private static final class Tracks {
        final boolean video;
        final boolean audio;

        Tracks(boolean video, boolean audio) {
            this.video = video;
            this.audio = audio;
        }
    }
}
