package com.pixelcut.editor.media;

import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.audio.BaseAudioProcessor;
import androidx.media3.common.util.UnstableApi;

import java.nio.ByteBuffer;

@OptIn(markerClass = UnstableApi.class)
final class TransitionGainProcessor extends BaseAudioProcessor {
    private final long fadeInUs;
    private final long fadeOutUs;
    private final long durationUs;
    private long positionUs;

    TransitionGainProcessor(long fadeInUs, long fadeOutUs, long durationUs) {
        this.fadeInUs = Math.max(0, fadeInUs);
        this.fadeOutUs = Math.max(0, fadeOutUs);
        this.durationUs = Math.max(1, durationUs);
    }

    @Override
    public boolean isActive() {
        return super.isActive() && (fadeInUs > 0 || fadeOutUs > 0);
    }

    @Override
    protected AudioProcessor.AudioFormat onConfigure(AudioProcessor.AudioFormat inputAudioFormat)
        throws AudioProcessor.UnhandledAudioFormatException {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT
            && inputAudioFormat.encoding != C.ENCODING_PCM_FLOAT) {
            throw new AudioProcessor.UnhandledAudioFormatException(inputAudioFormat);
        }
        if (fadeInUs <= 0 && fadeOutUs <= 0) return AudioProcessor.AudioFormat.NOT_SET;
        return inputAudioFormat;
    }

    @Override
    protected void onFlush() {
        positionUs = 0;
    }

    @Override
    public void queueInput(ByteBuffer inputBuffer) {
        int encoding = inputAudioFormat.encoding;
        int channels = Math.max(1, inputAudioFormat.channelCount);
        int sampleRate = Math.max(1, inputAudioFormat.sampleRate);
        long frameUs = C.MICROS_PER_SECOND / sampleRate;
        int remaining = inputBuffer.remaining();
        ByteBuffer output = replaceOutputBuffer(remaining);
        if (encoding == C.ENCODING_PCM_FLOAT) {
            while (inputBuffer.remaining() >= 4 * channels) {
                float gain = TransitionMath.audioGain(positionUs, durationUs, fadeInUs, fadeOutUs);
                for (int channel = 0; channel < channels; channel++) {
                    output.putFloat(inputBuffer.getFloat() * gain);
                }
                positionUs += frameUs;
            }
        } else {
            while (inputBuffer.remaining() >= 2 * channels) {
                float gain = TransitionMath.audioGain(positionUs, durationUs, fadeInUs, fadeOutUs);
                for (int channel = 0; channel < channels; channel++) {
                    int sample = Math.round(inputBuffer.getShort() * gain);
                    if (sample > Short.MAX_VALUE) sample = Short.MAX_VALUE;
                    if (sample < Short.MIN_VALUE) sample = Short.MIN_VALUE;
                    output.putShort((short) sample);
                }
                positionUs += frameUs;
            }
        }
        output.flip();
    }
}
