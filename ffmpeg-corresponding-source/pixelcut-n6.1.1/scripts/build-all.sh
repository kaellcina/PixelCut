#!/usr/bin/env bash
# PixelCut — compilação própria FFmpeg/FFprobe n6.1.1 Windows x64
# GPLv2: --enable-gpl, SEM --enable-version3, SEM --enable-nonfree.
# Correr dentro de MSYS2 MINGW64.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
# Autotools/ld partem caminhos com espaço (ex.: "Capcut pro"). Compilar fora do desktop.
WORK="${PIXELCUT_FFMPEG_WORK:-/c/pixelcut-ffmpeg-n611}"
mkdir -p "$WORK/archives" "$WORK/patches" "$WORK/scripts"
if [[ "$REPO" != "$WORK" ]]; then
  cp -f "$REPO/archives/"* "$WORK/archives/"
  cp -f "$REPO/patches/"* "$WORK/patches/" 2>/dev/null || true
  cp -f "$REPO/scripts/build-all.sh" "$WORK/scripts/build-all.sh"
fi
ROOT="$WORK"
ARCHIVES="$ROOT/archives"
SRC="$ROOT/src"
PREFIX="$ROOT/prefix"
DIST="$ROOT/dist"
LOGS="$ROOT/logs"
PATCHES="$ROOT/patches"
JOBS="${NUMBER_OF_PROCESSORS:-4}"

export PATH="/mingw64/bin:/usr/bin:${PATH}"
export PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig"
export PKG_CONFIG="pkgconf --static"
export CC=gcc
export CXX=g++
export CFLAGS="-O2 -I${PREFIX}/include"
export CXXFLAGS="-O2 -I${PREFIX}/include"
export LDFLAGS="-L${PREFIX}/lib"
export ACLOCAL_PATH="${PREFIX}/share/aclocal:${ACLOCAL_PATH:-}"

mkdir -p "$SRC" "$PREFIX" "$DIST" "$LOGS" "$PATCHES"

log() { printf '[pixelcut-ffmpeg] %s\n' "$*"; }
run() {
  local name="$1"; shift
  log ">> $name"
  if ! "$@" >"$LOGS/${name}.log" 2>&1; then
    echo "FALHOU $name. Últimas linhas de $LOGS/${name}.log:" >&2
    tail -n 40 "$LOGS/${name}.log" >&2 || true
    exit 1
  fi
}

need() {
  local f="$ARCHIVES/$1"
  [[ -f "$f" ]] || { echo "Falta arquivo pinado: $f" >&2; exit 1; }
}

need ffmpeg-6.1.1.tar.xz
need x264-c1c9931dc87289-git-archive.tar.gz
need rubberband-1.8.1.tar.bz2
need freetype-2.13.2.tar.xz
need harfbuzz-8.3.0.tar.xz
need zlib-1.3.1.tar.gz
need fftw-3.3.10.tar.gz
need libsamplerate-0.2.2.tar.xz

extract() {
  local archive="$1" dest="$2"
  rm -rf "$dest"
  mkdir -p "$dest"
  case "$archive" in
    *.tar.xz) tar -xJf "$archive" -C "$dest" --strip-components=1 ;;
    *.tar.bz2) tar -xjf "$archive" -C "$dest" --strip-components=1 ;;
    *.tar.gz) tar -xzf "$archive" -C "$dest" --strip-components=1 ;;
    *) echo "arquivo desconhecido $archive" >&2; exit 1 ;;
  esac
}

{
  echo "date=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "uname=$(uname -a)"
  echo "gcc=$(gcc --version | head -1)"
  echo "gxx=$(g++ --version | head -1)"
  echo "nasm=$(nasm -v)"
  echo "pkgconf=$(pkgconf --version)"
  echo "make=$(make --version | head -1)"
  echo "meson=$(meson --version 2>/dev/null || echo absent)"
  echo "ninja=$(ninja --version 2>/dev/null || echo absent)"
} | tee "$LOGS/toolchain.txt"

# --- zlib ---
if [[ ! -f "$PREFIX/lib/libz.a" ]]; then
  extract "$ARCHIVES/zlib-1.3.1.tar.gz" "$SRC/zlib"
  pushd "$SRC/zlib" >/dev/null
  # Só a biblioteca estática: o Makefile.gcc também tenta example.exe/minigzip.exe e falha no ld deste MinGW.
  run zlib-make make -f win32/Makefile.gcc libz.a
  mkdir -p "$PREFIX/lib" "$PREFIX/include"
  cp -f libz.a "$PREFIX/lib/libz.a"
  cp -f zlib.h zconf.h "$PREFIX/include/"
  if [[ ! -f "$PREFIX/lib/pkgconfig/zlib.pc" ]]; then
    mkdir -p "$PREFIX/lib/pkgconfig"
    cat >"$PREFIX/lib/pkgconfig/zlib.pc" <<EOF
prefix=$PREFIX
exec_prefix=\${prefix}
libdir=\${exec_prefix}/lib
includedir=\${prefix}/include

Name: zlib
Description: zlib compression library
Version: 1.3.1
Libs: -L\${libdir} -lz
Cflags: -I\${includedir}
EOF
  fi
  popd >/dev/null
fi

# --- FFTW (double, needed by Rubber Band 1.8.1) ---
if [[ ! -f "$PREFIX/lib/libfftw3.a" ]]; then
  extract "$ARCHIVES/fftw-3.3.10.tar.gz" "$SRC/fftw"
  pushd "$SRC/fftw" >/dev/null
  run fftw-configure ./configure --prefix="$PREFIX" --enable-static --disable-shared \
    --enable-sse2 --enable-avx --with-our-malloc --disable-fortran --disable-doc
  run fftw-make make -j"$JOBS"
  run fftw-install make install
  popd >/dev/null
fi

# --- libsamplerate ---
if [[ ! -f "$PREFIX/lib/libsamplerate.a" ]]; then
  extract "$ARCHIVES/libsamplerate-0.2.2.tar.xz" "$SRC/libsamplerate"
  pushd "$SRC/libsamplerate" >/dev/null
  run samplerate-configure ./configure --prefix="$PREFIX" --enable-static --disable-shared --disable-sndfile
  run samplerate-make make -j"$JOBS"
  run samplerate-install make install
  popd >/dev/null
fi

# --- x264 ---
if [[ ! -f "$PREFIX/lib/libx264.a" ]]; then
  extract "$ARCHIVES/x264-c1c9931dc87289-git-archive.tar.gz" "$SRC/x264"
  pushd "$SRC/x264" >/dev/null
  run x264-configure ./configure --prefix="$PREFIX" --enable-static --disable-cli --disable-opencl \
    --disable-avs --disable-ffms --disable-gpac --disable-lsmash --enable-pic
  run x264-make make -j"$JOBS"
  run x264-install make install
  popd >/dev/null
fi

# --- freetype (drawtext; sem harfbuzz/png/brotli) ---
if [[ ! -f "$PREFIX/lib/libfreetype.a" ]]; then
  extract "$ARCHIVES/freetype-2.13.2.tar.xz" "$SRC/freetype"
  pushd "$SRC/freetype" >/dev/null
  run freetype-configure ./configure --prefix="$PREFIX" --enable-static --disable-shared \
    --without-harfbuzz --without-brotli --without-png --without-bzip2 --with-zlib=yes
  run freetype-make make -j"$JOBS"
  run freetype-install make install
  popd >/dev/null
fi

# --- HarfBuzz 8.3.0 (drawtext no FFmpeg 6.1 exige libfreetype + libharfbuzz) ---
if [[ ! -f "$PREFIX/lib/libharfbuzz.a" ]]; then
  extract "$ARCHIVES/harfbuzz-8.3.0.tar.xz" "$SRC/harfbuzz"
  pushd "$SRC/harfbuzz" >/dev/null
  run harfbuzz-meson meson setup build \
    --prefix="$PREFIX" \
    --default-library=static \
    --buildtype=release \
    -Dtests=disabled \
    -Ddocs=disabled \
    -Dcairo=disabled \
    -Dglib=disabled \
    -Dgobject=disabled \
    -Dicu=disabled \
    -Dintrospection=disabled \
    -Dfreetype=enabled \
    -Dchafa=disabled \
    -Dutilities=disabled
  run harfbuzz-ninja ninja -C build
  run harfbuzz-install ninja -C build install
  popd >/dev/null
fi

# --- Rubber Band 1.8.1 ---
# configure exige sndfile/vamp-sdk só para CLI/plugins. Dummy + `make static` = só librubberband.a.
if [[ ! -f "$PREFIX/lib/librubberband.a" ]]; then
  extract "$ARCHIVES/rubberband-1.8.1.tar.bz2" "$SRC/rubberband"
  pushd "$SRC/rubberband" >/dev/null
  export SNDFILE_CFLAGS="-I${PREFIX}/include"
  export SNDFILE_LIBS="-L${PREFIX}/lib"
  export Vamp_CFLAGS="-I${PREFIX}/include"
  export Vamp_LIBS="-L${PREFIX}/lib"
  run rubberband-configure ./configure --prefix="$PREFIX"
  mkdir -p lib
  run rubberband-make make static -j"$JOBS"
  mkdir -p "$PREFIX/include/rubberband" "$PREFIX/lib/pkgconfig"
  cp -f rubberband/rubberband-c.h rubberband/RubberBandStretcher.h "$PREFIX/include/rubberband/"
  cp -f lib/librubberband.a "$PREFIX/lib/"
  cat >"$PREFIX/lib/pkgconfig/rubberband.pc" <<EOF
prefix=$PREFIX
exec_prefix=\${prefix}
libdir=\${exec_prefix}/lib
includedir=\${prefix}/include

Name: rubberband
Description: Rubber Band audio time-stretching
Version: 1.8.1
Libs: -L\${libdir} -lrubberband -lsamplerate -lfftw3
Cflags: -I\${includedir}
EOF
  unset SNDFILE_CFLAGS SNDFILE_LIBS Vamp_CFLAGS Vamp_LIBS
  popd >/dev/null
fi

# --- FFmpeg n6.1.1 ---
extract "$ARCHIVES/ffmpeg-6.1.1.tar.xz" "$SRC/ffmpeg"
pushd "$SRC/ffmpeg" >/dev/null

# Zero patches: o diretório patches/ só contém README.
if compgen -G "$PATCHES/*.patch" > /dev/null; then
  for p in "$PATCHES"/*.patch; do
    log "aplicando patch $p"
    patch -p1 < "$p"
  done
fi

run ffmpeg-configure ./configure \
  --prefix="$PREFIX" \
  --pkg-config-flags=--static \
  --extra-cflags="-I${PREFIX}/include" \
  --extra-ldflags="-L${PREFIX}/lib -static" \
  --extra-libs="-lstdc++ -lsamplerate -lfftw3 -lz -lpthread" \
  --arch=x86_64 \
  --target-os=mingw32 \
  --pkg-config=pkgconf \
  --enable-gpl \
  --enable-static \
  --disable-shared \
  --disable-autodetect \
  --disable-debug \
  --disable-doc \
  --disable-htmlpages \
  --disable-manpages \
  --disable-podpages \
  --disable-txtpages \
  --disable-ffplay \
  --disable-network \
  --disable-indevs \
  --enable-indev=lavfi \
  --disable-outdevs \
  --enable-libx264 \
  --enable-librubberband \
  --enable-libfreetype \
  --enable-libharfbuzz \
  --enable-zlib

cp -f ffbuild/config.log "$LOGS/ffmpeg-config.log" || true
./ffbuild/config.sh > "$LOGS/ffmpeg-config.sh.txt" 2>/dev/null || true

run ffmpeg-make make -j"$JOBS"
run ffmpeg-install make install
popd >/dev/null

cp -f "$PREFIX/bin/ffmpeg.exe" "$DIST/ffmpeg.exe"
cp -f "$PREFIX/bin/ffprobe.exe" "$DIST/ffprobe.exe"

{
  echo "=== ffmpeg -version ==="
  "$DIST/ffmpeg.exe" -version
  echo "=== ffmpeg -buildconf ==="
  "$DIST/ffmpeg.exe" -buildconf
  echo "=== ffprobe -version ==="
  "$DIST/ffprobe.exe" -version
} | tee "$LOGS/binaries-version.txt"

{
  echo "ffmpeg.exe  $(sha256sum "$DIST/ffmpeg.exe")"
  echo "ffprobe.exe $(sha256sum "$DIST/ffprobe.exe")"
} | tee "$DIST/SHA256SUMS.txt"

if ! "$DIST/ffmpeg.exe" -hide_banner -filters 2>/dev/null | grep -q 'drawtext'; then
  echo "drawtext ausente no ffmpeg gerado — libharfbuzz/libfreetype não ligados" >&2
  exit 1
fi

if [[ "$REPO" != "$WORK" ]]; then
  mkdir -p "$REPO/dist" "$REPO/logs"
  cp -f "$DIST/ffmpeg.exe" "$DIST/ffprobe.exe" "$DIST/SHA256SUMS.txt" "$REPO/dist/"
  cp -f "$LOGS/"* "$REPO/logs/"
  log "cópias em $REPO/dist e $REPO/logs"
fi
log "OK dist/ffmpeg.exe dist/ffprobe.exe"
