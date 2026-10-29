# Fixtures de probe (HEVC / MP3)

O FFmpeg PixelCut n6.1.1 **descodifica** HEVC e MP3 de forma nativa, mas **não** os codifica (sem libx265 / lame).

Estes dois ficheiros foram gerados uma vez com o Gyan de rollback e servem só para `scripts/test-ffprobe.cjs` confirmar o probe/import:

- `hevc-sample.mp4` — 640×360, 1 s, `hvc1`
- `tone.mp3` — seno 880 Hz, 2 s

Não vão no instalador.
