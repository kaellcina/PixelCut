package com.pixelcut.editor;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.activity.result.ActivityResult;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.pixelcut.editor.media.MainTrackExporter;
import com.pixelcut.editor.media.MediaFiles;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "PixelCut")
public class PixelCutPlugin extends Plugin {
    private ExecutorService io;
    private final Handler main = new Handler(Looper.getMainLooper());
    private MainTrackExporter exporter;
    private PluginCall exportCall;

    @Override
    public void load() {
        io = Executors.newSingleThreadExecutor();
    }

    @Override
    protected void handleOnDestroy() {
        cancelActive();
        if (io != null) io.shutdownNow();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void importMedia(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {"video/*", "image/*", "audio/*"});
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "importResult");
    }

    @ActivityCallback
    private void importResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject empty = new JSObject();
            empty.put("items", new JSArray());
            call.resolve(empty);
            return;
        }
        List<Uri> uris = urisFrom(result.getData());
        call.setKeepAlive(Boolean.TRUE);
        io.execute(() -> {
            JSArray items = new JSArray();
            for (Uri uri : uris) {
                JSObject item = new JSObject();
                String name = "Arquivo";
                try {
                    MediaFiles.CopiedMedia copied = MediaFiles.copy(getContext(), uri);
                    name = copied.name;
                    item.put("name", copied.name);
                    item.put("source", copied.source);
                    item.put("type", copied.type);
                    item.put("duration", copied.duration);
                    item.put("width", copied.width);
                    item.put("height", copied.height);
                    item.put("hasVideo", copied.hasVideo);
                    item.put("hasAudio", copied.hasAudio);
                } catch (Exception error) {
                    item.put("name", name);
                    item.put("error", error.getMessage() == null ? "Não foi possível copiar o arquivo." : error.getMessage());
                }
                items.put(item);
            }
            JSObject payload = new JSObject();
            payload.put("items", items);
            main.post(() -> call.resolve(payload));
        });
    }

    @PluginMethod
    public void deleteMedia(PluginCall call) {
        boolean ok = MediaFiles.deleteOwned(getContext(), call.getString("source", ""));
        JSObject result = new JSObject();
        result.put("ok", ok);
        call.resolve(result);
    }

    @PluginMethod
    public void restoreMedia(PluginCall call) {
        JSArray sources = call.getArray("sources");
        JSArray items = new JSArray();
        if (sources != null) {
            for (int i = 0; i < sources.length(); i++) {
                JSObject item = new JSObject();
                String source = "";
                try {
                    source = sources.getString(i);
                } catch (JSONException ignored) {
                    source = "";
                }
                item.put("ok", source != null && !source.isEmpty() && MediaFiles.exists(getContext(), source));
                items.put(item);
            }
        }
        JSObject result = new JSObject();
        result.put("items", items);
        call.resolve(result);
    }

    @PluginMethod
    public void exportVideo(PluginCall call) {
        if (exporter != null) {
            call.reject("Já existe uma exportação em andamento.");
            return;
        }
        if (Build.VERSION.SDK_INT <= 28 && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            Activity activity = getActivity();
            if (activity != null) {
                ActivityCompat.requestPermissions(activity, new String[] {Manifest.permission.WRITE_EXTERNAL_STORAGE}, 4108);
            }
            call.reject("O Android precisa de permissão para salvar o vídeo em Filmes/PixelCut. Aceite a permissão e exporte de novo.");
            return;
        }
        JSObject plan = call.getObject("plan");
        if (plan == null) {
            call.reject("O projeto não tem uma composição para exportar.");
            return;
        }
        exportCall = call;
        call.setKeepAlive(Boolean.TRUE);
        exporter = new MainTrackExporter();
        AtomicBoolean settled = new AtomicBoolean(false);
        exporter.start(getContext(), plan, new MainTrackExporter.Callback() {
            @Override
            public void onProgress(double progress) {
                JSObject event = new JSObject();
                event.put("progress", progress);
                notifyListeners("progress", event);
            }

            @Override
            public void onSuccess(Uri uri, String display) {
                if (!settled.compareAndSet(false, true)) return;
                JSObject result = new JSObject();
                result.put("uri", uri.toString());
                result.put("display", display);
                main.post(() -> resolveExport(result));
            }

            @Override
            public void onFailure(String message) {
                if (!settled.compareAndSet(false, true)) return;
                main.post(() -> rejectExport(message));
            }

            @Override
            public void onCanceled() {
                if (!settled.compareAndSet(false, true)) return;
                JSObject result = new JSObject();
                result.put("canceled", true);
                main.post(() -> resolveExport(result));
            }
        });
    }

    @PluginMethod
    public void cancelExport(PluginCall call) {
        cancelActive();
        call.resolve();
    }

    @PluginMethod
    public void openVideo(PluginCall call) {
        launch(call, Intent.ACTION_VIEW, false);
    }

    @PluginMethod
    public void shareVideo(PluginCall call) {
        launch(call, Intent.ACTION_SEND, true);
    }

    private void launch(PluginCall call, String action, boolean share) {
        String raw = call.getString("uri", "");
        if (raw == null || raw.isEmpty()) {
            call.reject("Não há um vídeo exportado para abrir.");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("A tela do PixelCut não está disponível.");
            return;
        }
        Uri uri = Uri.parse(raw);
        Intent intent = new Intent(action);
        intent.setDataAndType(uri, "video/mp4");
        intent.putExtra(Intent.EXTRA_STREAM, uri);
        intent.setClipData(ClipData.newRawUri("PixelCut", uri));
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            activity.startActivity(share ? Intent.createChooser(intent, "Compartilhar vídeo") : intent);
            call.resolve();
        } catch (Exception error) {
            call.reject(share ? "Não foi possível compartilhar o vídeo." : "Nenhum aplicativo do aparelho conseguiu abrir este vídeo.");
        }
    }

    private void resolveExport(JSObject result) {
        PluginCall call = exportCall;
        exporter = null;
        exportCall = null;
        if (call != null) call.resolve(result);
    }

    private void rejectExport(String message) {
        PluginCall call = exportCall;
        exporter = null;
        exportCall = null;
        if (call != null) call.reject(message == null ? "A exportação falhou." : message);
    }

    private void cancelActive() {
        MainTrackExporter active = exporter;
        if (active != null) active.cancel();
    }

    private static List<Uri> urisFrom(Intent data) {
        List<Uri> uris = new ArrayList<>();
        ClipData clip = data.getClipData();
        if (clip != null) {
            for (int i = 0; i < clip.getItemCount(); i++) uris.add(clip.getItemAt(i).getUri());
        } else if (data.getData() != null) {
            uris.add(data.getData());
        }
        return uris;
    }
}
