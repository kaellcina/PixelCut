package com.pixelcut.editor.media;

import android.content.Context;
import android.opengl.GLES20;

import androidx.annotation.OptIn;
import androidx.media3.common.VideoFrameProcessingException;
import androidx.media3.common.util.GlProgram;
import androidx.media3.common.util.GlUtil;
import androidx.media3.common.util.Size;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.effect.BaseGlShaderProgram;
import androidx.media3.effect.GlEffect;

import java.util.ArrayList;
import java.util.List;

@OptIn(markerClass = UnstableApi.class)
final class TransitionWipeEffect implements GlEffect {
    static final class Window {
        final String type;
        final long startUs;
        final long endUs;
        final boolean overlayIncoming;

        Window(String type, long startUs, long endUs, boolean overlayIncoming) {
            this.type = type;
            this.startUs = startUs;
            this.endUs = endUs;
            this.overlayIncoming = overlayIncoming;
        }
    }

    private final List<Window> windows;

    TransitionWipeEffect(List<Window> windows) {
        this.windows = windows == null ? new ArrayList<>() : windows;
    }

    @Override
    public boolean isNoOp(int inputWidth, int inputHeight) {
        return windows.isEmpty();
    }

    @Override
    public BaseGlShaderProgram toGlShaderProgram(Context context, boolean useHdr)
        throws VideoFrameProcessingException {
        return new Program(windows);
    }

    private static final class Program extends BaseGlShaderProgram {
        private static final String VERTEX =
            "attribute vec4 aFramePosition;\n"
                + "varying vec2 vTex;\n"
                + "void main() {\n"
                + "  gl_Position = aFramePosition;\n"
                + "  vTex = vec2(aFramePosition.x * 0.5 + 0.5, aFramePosition.y * 0.5 + 0.5);\n"
                + "}\n";
        private static final String FRAGMENT =
            "precision mediump float;\n"
                + "varying vec2 vTex;\n"
                + "uniform sampler2D uTexSampler;\n"
                + "uniform float uCutoff;\n"
                + "uniform int uMode;\n"
                + "uniform int uIncoming;\n"
                + "void main() {\n"
                + "  vec4 color = texture2D(uTexSampler, vTex);\n"
                + "  float p = uCutoff;\n"
                + "  bool show;\n"
                + "  if (uMode == 1) show = vTex.x >= 1.0 - p;\n"
                + "  else if (uMode == 2) show = vTex.y <= p;\n"
                + "  else if (uMode == 3) show = vTex.y >= 1.0 - p;\n"
                + "  else show = vTex.x <= p;\n"
                + "  if (uIncoming == 0) show = !show;\n"
                + "  gl_FragColor = vec4(color.rgb, color.a * (show ? 1.0 : 0.0));\n"
                + "}\n";

        private final List<Window> windows;
        private final GlProgram glProgram;

        Program(List<Window> windows) throws VideoFrameProcessingException {
            super(false, 1);
            this.windows = windows;
            try {
                glProgram = new GlProgram(VERTEX, FRAGMENT);
                glProgram.setBufferAttribute(
                    "aFramePosition",
                    GlUtil.getNormalizedCoordinateBounds(),
                    GlUtil.HOMOGENEOUS_COORDINATE_VECTOR_SIZE
                );
            } catch (GlUtil.GlException error) {
                throw new VideoFrameProcessingException(error);
            }
        }

        @Override
        public Size configure(int inputWidth, int inputHeight) {
            return new Size(inputWidth, inputHeight);
        }

        @Override
        public void drawFrame(int inputTexId, long presentationTimeUs) throws VideoFrameProcessingException {
            Window window = windowAt(presentationTimeUs);
            try {
                glProgram.use();
                glProgram.setSamplerTexIdUniform("uTexSampler", inputTexId, 0);
                if (window == null) {
                    glProgram.setFloatUniform("uCutoff", 1f);
                    glProgram.setIntUniform("uMode", 0);
                    glProgram.setIntUniform("uIncoming", 1);
                } else {
                    float progress = (presentationTimeUs - window.startUs) / (float) Math.max(1, window.endUs - window.startUs);
                    glProgram.setFloatUniform("uCutoff", TransitionMath.wipeCutoff(window.type, progress));
                    glProgram.setIntUniform("uMode", TransitionMath.wipeMode(window.type));
                    glProgram.setIntUniform("uIncoming", window.overlayIncoming ? 1 : 0);
                }
                glProgram.bindAttributesAndUniforms();
                GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
            } catch (GlUtil.GlException error) {
                throw new VideoFrameProcessingException(error, presentationTimeUs);
            }
        }

        @Override
        public void release() throws VideoFrameProcessingException {
            super.release();
            try {
                glProgram.delete();
            } catch (GlUtil.GlException error) {
                throw new VideoFrameProcessingException(error);
            }
        }

        private Window windowAt(long presentationTimeUs) {
            for (int i = 0; i < windows.size(); i++) {
                Window window = windows.get(i);
                if (presentationTimeUs >= window.startUs && presentationTimeUs < window.endUs) return window;
            }
            return null;
        }
    }
}
