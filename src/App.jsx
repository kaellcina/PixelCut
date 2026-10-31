import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { CLIP_MOTIONS } from './catalog.js';
import { togglePlaybackState } from './playback.js';
import { buildProjectFromImportedMedia, clampPlayhead, clipLength, emptyProject, formatTime, historyReducer, projectDuration, transitionApplyId, uid, videoClipAt, videoLayout } from './store.js';
import { audioChainInfo, audioLatency, unlockAudio, voiceSelfTest } from './audioFx.js';
import { createAutosave } from './projects/autosave.js';
import { fingerprint, firstVisualMedia } from './projects/schema.js';
import { captureProjectThumb } from './projects/thumbnail.js';
import MediaLibrary from './components/MediaLibrary.jsx';
import Preview from './components/Preview.jsx';
import Timeline from './components/Timeline.jsx';
import Inspector from './components/Inspector.jsx';
import ExportDialog from './components/ExportDialog.jsx';
import HomeScreen from './components/HomeScreen.jsx';
import MissingMediaDialog from './components/MissingMediaDialog.jsx';
import { platform, prefersMobileLayout } from './platform/index.js';
import { androidVisualTransitionWarnings, planMainExport } from './platform/exportPlan.js';
import { readAudioScrubPref, writeAudioScrubPref } from './audioScrub.js';
import pixelcutIcon from '../assets/icon.png';

export default function App() {
  const [state, dispatch] = useReducer(historyReducer, { past: [], present: emptyProject(), future: [] });
  const project = state.present;
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selection, setSelection] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [toast, setToast] = useState('');
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 860px)').matches);
  const [mobile, setMobile] = useState(() => prefersMobileLayout());
  const [drawer, setDrawer] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState('media');
  const [sheet, setSheet] = useState('half');
  const duration = projectDuration(project);
  const [seekVer, setSeekVer] = useState(0);
  const [session, setSession] = useState(() => (typeof window !== 'undefined' && window.api?.isSmoke ? { ephemeral: true } : null));
  const [homeLoading, setHomeLoading] = useState(true);
  const [recents, setRecents] = useState([]);
  const [thumbs, setThumbs] = useState({});
  const [saveInfo, setSaveInfo] = useState({ status: 'idle', savedAt: null, error: null });
  const [missing, setMissing] = useState([]);
  const [scrubbing, setScrubbing] = useState(false);
  const [cutToken, setCutToken] = useState(0);
  const [audioScrub, setAudioScrub] = useState(() => (typeof window === 'undefined' ? true : readAudioScrubPref()));
  const [nameEdit, setNameEdit] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const transitionPickRef = useRef(null);

  useEffect(() => {
    const queries = ['(max-width: 860px)', '(max-height: 520px)', '(pointer: coarse)'].map((query) => window.matchMedia(query));
    const sync = () => {
      setNarrow(queries[0].matches);
      setMobile(prefersMobileLayout());
    };
    sync();
    queries.forEach((query) => query.addEventListener('change', sync));
    return () => queries.forEach((query) => query.removeEventListener('change', sync));
  }, []);

  const clampTime = useCallback((target) => clampPlayhead(target, duration), [duration]);
  const seek = useCallback((target) => {
    setTime(clampTime(target));
    setSeekVer((value) => value + 1);
  }, [clampTime]);
  const seekLive = useCallback((target) => {
    setTime(clampTime(target));
  }, [clampTime]);

  useEffect(() => {
    const next = clampPlayhead(time, duration);
    if (next !== time) setTime(next);
  }, [duration, time]);

  const playbackRef = useRef({ playing: false, time: 0, duration: 0 });
  playbackRef.current = { playing, time, duration };
  const sessionRef = useRef(session);
  const projectRef = useRef(project);
  const timeRef = useRef(time);
  // Media removed from the library stays on disk until the project closes, so Ctrl+Z can bring it back.
  const removedMediaRef = useRef([]);
  sessionRef.current = session;
  projectRef.current = project;
  timeRef.current = time;

  const autosave = useMemo(() => createAutosave({
    delay: platform.kind() === 'android' ? 500 : 700,
    save: async (payload) => {
      const live = payload && typeof payload === 'object'
        ? {
          ...payload,
          id: sessionRef.current?.id || payload.id,
          project: projectRef.current || payload.project,
          playhead: timeRef.current,
        }
        : payload;
      await platform.persistProject(live);
    },
  }), []);

  const refreshRecents = useCallback(async () => {
    try {
      const listed = await platform.listProjects();
      setRecents(listed);
      const next = {};
      await Promise.all(listed.filter((item) => item.hasThumb).map(async (item) => {
        try {
          next[item.id] = await platform.getProjectThumbnail(item.id);
        } catch {
          next[item.id] = null;
        }
      }));
      setThumbs((current) => ({ ...current, ...next }));
    } catch {
      setRecents([]);
    } finally {
      setHomeLoading(false);
    }
  }, []);

  useEffect(() => { refreshRecents(); }, [refreshRecents]);

  useEffect(() => autosave.subscribe(setSaveInfo), [autosave]);

  useEffect(() => {
    if (!session?.id || session.ephemeral) return undefined;
    autosave.schedule(
      () => ({ id: sessionRef.current?.id, project: projectRef.current, playhead: timeRef.current }),
      fingerprint(project, timeRef.current),
    );
    return undefined;
  }, [autosave, project, session]);

  useEffect(() => {
    if (!session?.id || session.ephemeral || playing) return undefined;
    autosave.schedule(
      () => ({ id: sessionRef.current?.id, project: projectRef.current, playhead: timeRef.current }),
      fingerprint(projectRef.current, time),
    );
    return undefined;
  }, [autosave, playing, session, time]);

  useEffect(() => {
    if (!session?.id || session.ephemeral || saveInfo.status !== 'saved') return undefined;
    const media = firstVisualMedia(projectRef.current);
    if (!media || thumbs[session.id]) return undefined;
    let cancelled = false;
    captureProjectThumb(projectRef.current).then(async (shot) => {
      if (cancelled || !shot?.dataUrl || sessionRef.current?.id !== session.id) return;
      await platform.saveThumbnail(session.id, shot.dataUrl, shot.mediaId);
      setThumbs((current) => ({ ...current, [session.id]: shot.dataUrl }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [saveInfo.status, session, thumbs]);

  const openDocument = useCallback((document, missingItems = []) => {
    dispatch({ type: 'load', project: document.project });
    setSession({ id: document.id });
    setTime(clampPlayhead(document.playhead || 0, projectDuration(document.project)));
    setSelection(null);
    setPlaying(false);
    setSeekVer((value) => value + 1);
    setMissing(missingItems || []);
    setDrawer(null);
    setMenuOpen(false);
    setNameEdit(false);
    setNameDraft(document.project?.name || '');
    transitionPickRef.current = null;
  }, []);

  const createAndOpen = async () => {
    try {
      const created = await platform.createProject({ name: 'Projeto sem título' });
      openDocument(created.document);
      announce('Projeto criado');
    } catch (error) {
      alert(error.message || 'Não foi possível criar o projeto.');
    }
  };

  const createFromPicker = async () => {
    try {
      const items = await platform.importMedia();
      if (!items?.length) return;
      const ok = items.filter((item) => !item.error).map((item) => ({ ...item, id: uid() }));
      const bad = items.filter((item) => item.error);
      if (bad.length) alert('Não foi possível importar alguns arquivos:\n' + bad.map((item) => `${item.name}: ${item.error}`).join('\n'));
      if (!ok.length) return;
      const project = buildProjectFromImportedMedia(ok);
      const created = await platform.createProject({ name: project.name, project });
      openDocument(created.document);
      announce(`${ok.length} arquivo(s) na timeline`);
    } catch (error) {
      alert(error.message || 'Não foi possível criar o projeto.');
    }
  };

  const openRecent = async (id) => {
    try {
      const loaded = await platform.loadProject(id);
      openDocument(loaded.document, loaded.missing);
      announce('Projeto aberto');
    } catch (error) {
      alert('Não foi possível abrir o projeto: ' + error.message);
    }
  };

  const flushSave = async () => {
    if (!sessionRef.current?.id || sessionRef.current.ephemeral) return { status: 'idle' };
    autosave.schedule(
      () => ({ id: sessionRef.current.id, project: projectRef.current, playhead: timeRef.current }),
      fingerprint(projectRef.current, timeRef.current),
    );
    return autosave.flush();
  };

  // Only after a successful save: the file on disk must no longer reference what gets released.
  // shortcut: media removed right before the app is killed is never released; sweep orphans on startup if storage grows.
  const releaseRemovedMedia = () => {
    const kept = new Set(projectRef.current.media.map((item) => item.id));
    removedMediaRef.current.filter((item) => !kept.has(item.id)).forEach((item) => platform.releaseMedia(item));
    removedMediaRef.current = [];
  };

  const goHome = async () => {
    setPlaying(false);
    const result = await flushSave();
    if (result.status === 'error') {
      const leave = window.confirm('Falha ao salvar. Voltar à tela inicial mesmo assim? As edições continuam na memória até você tentar de novo.');
      if (!leave) return;
      removedMediaRef.current = [];
    } else {
      releaseRemovedMedia();
    }
    setSession(null);
    setMissing([]);
    dispatch({ type: 'load', project: emptyProject() });
    setTime(0);
    setSelection(null);
    setSeekVer((value) => value + 1);
    await refreshRecents();
  };

  useEffect(() => {
    const off = platform.onAppClosing(async () => {
      try { await flushSave(); } catch { /* still close */ }
      platform.readyToClose();
    });
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushSave();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushSave);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushSave);
    };
  }, [autosave]);
  const toggleGuard = useRef(false);
  const togglePlay = useCallback(() => {
    if (toggleGuard.current) return;
    toggleGuard.current = true;
    queueMicrotask(() => { toggleGuard.current = false; });
    unlockAudio();
    const now = playbackRef.current;
    const next = togglePlaybackState(now.playing, now.time, now.duration);
    playbackRef.current = { ...now, playing: next.playing, time: next.time };
    if (next.time !== now.time) seek(next.time);
    setPlaying(next.playing);
  }, [seek]);

  const announce = (message) => {
    setToast(message);
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(() => setToast(''), 2200);
  };

  const compact = narrow || mobile;

  const select = (next) => {
    setSelection(next);
    if (next?.track === 'transition') {
      transitionPickRef.current = next.id;
      if (mobile) openCategory('transitions', { toggle: false });
      return;
    }
    transitionPickRef.current = null;
    if (!next) return;
    if (mobile && next.track === 'text') {
      setDrawer('inspector');
      setSheet('half');
      return;
    }
    if (compact && !mobile) setDrawer('inspector');
  };

  const openCategory = (id, { toggle = true } = {}) => {
    setMenuOpen(false);
    if (toggle && drawer === 'library' && libraryTab === id) {
      setDrawer(null);
      return;
    }
    setLibraryTab(id);
    setSheet('half');
    setDrawer('library');
  };

  const importMedia = async () => {
    const items = await platform.importMedia();
    const ok = items.filter((item) => !item.error).map((item) => ({ ...item, id: uid() }));
    const bad = items.filter((item) => item.error);
    if (bad.length) alert('Não foi possível importar alguns arquivos:\n' + bad.map((item) => `${item.name}: ${item.error}`).join('\n'));
    if (ok.length) {
      dispatch({ type: 'addMedia', items: ok });
      const emptyTimeline = !project.videoClips.length
        && !project.audioClips.length
        && !(project.overlayClips || []).length
        && !project.textClips.length;
      if (emptyTimeline) {
        ok.forEach((item) => {
          dispatch({
            type: 'addToTimeline',
            mediaId: item.id,
            clipId: uid(),
            at: 0,
            track: item.type === 'image' ? 'video' : undefined,
          });
        });
        announce(`${ok.length} arquivo(s) na timeline`);
        return;
      }
      if (mobile) {
        setLibraryTab('media');
        setSheet('half');
        setDrawer('library');
        announce('Toque em ＋ para colocar o clipe na timeline');
      } else announce(`${ok.length} arquivo(s) importado(s)`);
    }
  };

  const addToTimeline = (mediaId, drop = null) => {
    const media = project.media.find((item) => item.id === mediaId);
    if (!media) return;
    const clipId = uid();
    const at = typeof drop?.at === 'number' ? drop.at : time;
    if (media.type === 'image' || drop?.track === 'overlay') {
      dispatch({ type: 'addToTimeline', mediaId, clipId, at, track: 'overlay', lane: drop?.lane ?? 0 });
      select({ track: 'overlay', id: clipId });
      if (drop) announce(`${media.name} na sobreposição`);
      return;
    }
    let toIndex;
    if (media.type === 'video' && drop?.track === 'video') {
      const layout = videoLayout(project.videoClips);
      const insertBefore = layout.find((item) => at < (item.start + item.end) / 2);
      toIndex = insertBefore ? layout.findIndex((item) => item.clip.id === insertBefore.clip.id) : project.videoClips.length;
    }
    dispatch({ type: 'addToTimeline', mediaId, clipId, at, toIndex });
    select({ track: media.type === 'video' ? 'video' : 'audio', id: clipId });
    if (drop) {
      seek(at);
      announce(`${media.name} adicionado`);
    }
  };

  const addText = (preset) => {
    const clipId = uid();
    dispatch({ type: 'addText', clipId, at: time, preset });
    select({ track: 'text', id: clipId });
    if (mobile) { setDrawer('inspector'); setSheet('half'); }
    announce('Texto adicionado');
  };

  const applyEffect = (effectId, at = time, trackHint) => {
    const motion = CLIP_MOTIONS.find((item) => item.id === effectId);
    const zoomPatch = motion && { zoom: { preset: motion.id, from: motion.from, to: motion.to, duration: 1 } };
    if (trackHint === 'overlay' || trackHint === 'overlay2') {
      const overlay = (project.overlayClips || []).find((clip) => (
        at >= clip.start && at < clip.start + clipLength(clip)
        && ((trackHint === 'overlay2' ? 1 : 0) === (clip.lane || 0))
      ));
      if (!overlay) return announce('Solte o efeito sobre o clipe');
      if (zoomPatch) dispatch({ type: 'update', track: 'overlay', id: overlay.id, patch: zoomPatch });
      else dispatch({ type: 'toggleEffect', track: 'overlay', id: overlay.id, effect: effectId });
      select({ track: 'overlay', id: overlay.id });
      announce('Efeito só neste clipe');
      return;
    }
    if (trackHint === 'video') {
      const hit = videoClipAt(project, at)?.clip;
      if (!hit) return announce('Solte o efeito sobre o clipe');
      if (zoomPatch) dispatch({ type: 'update', track: 'video', id: hit.id, patch: zoomPatch });
      else dispatch({ type: 'toggleEffect', track: 'video', id: hit.id, effect: effectId });
      select({ track: 'video', id: hit.id });
      announce('Efeito só neste clipe');
      return;
    }
    if (selection?.track === 'overlay' || selection?.track === 'video') {
      if (zoomPatch) dispatch({ type: 'update', track: selection.track, id: selection.id, patch: zoomPatch });
      else dispatch({ type: 'toggleEffect', track: selection.track, id: selection.id, effect: effectId });
      announce(zoomPatch ? 'Zoom só neste clipe' : 'Efeito só neste clipe');
      return;
    }
    announce('Clique no clipe que quer editar');
  };

  const applyAudioEffect = (effectId, at = time, trackHint) => {
    if (trackHint === 'audio' || trackHint === 'linked') {
      if (trackHint === 'linked') {
        const hit = videoClipAt(project, at)?.clip;
        if (!hit) return announce('Solte o efeito sobre o áudio');
        dispatch({ type: 'toggleAudioEffect', track: 'video', id: hit.id, effect: effectId });
        select({ track: 'video', id: hit.id });
        announce('Efeito só neste clipe');
        return;
      }
      const audio = project.audioClips.find((clip) => at >= clip.start && at < clip.start + clipLength(clip));
      if (!audio) return announce('Solte o efeito sobre o clipe de áudio');
      dispatch({ type: 'toggleAudioEffect', track: 'audio', id: audio.id, effect: effectId });
      select({ track: 'audio', id: audio.id });
      announce('Efeito só neste clipe');
      return;
    }
    if (selection?.track === 'audio') {
      dispatch({ type: 'toggleAudioEffect', track: 'audio', id: selection.id, effect: effectId });
      announce('Efeito só neste clipe');
      return;
    }
    if (selection?.track === 'video') {
      dispatch({ type: 'toggleAudioEffect', track: 'video', id: selection.id, effect: effectId });
      announce('Efeito só neste clipe');
      return;
    }
    announce('Clique no clipe de áudio ou no vídeo');
  };

  const unlink = () => {
    if (selection?.track !== 'video') return announce('Selecione o vídeo principal');
    dispatch({ type: 'unlinkAudio', id: selection.id, audioId: uid() });
    announce('Áudio separado na faixa Áudio');
  };

  const applyTransition = (type, at = time) => {
    const chosen = selection?.track === 'transition' ? selection : null;
    const id = transitionApplyId(project, chosen, at);
    if (!id) return announce('Toque no losango entre dois clipes');
    const current = project.videoClips.find((clip) => clip.id === id);
    const duration = current?.transitionIn?.duration || 0.5;
    const before = projectDuration(project);
    dispatch({ type: 'setTransition', id, transition: { type, duration } });
    transitionPickRef.current = id;
    select({ track: 'transition', id });
    const after = projectDuration({
      ...project,
      videoClips: project.videoClips.map((clip) => (
        clip.id === id ? { ...clip, transitionIn: { type, duration } } : clip
      )),
    });
    const delta = before - after;
    announce(delta > 0.02
      ? `Sobreposição de ${delta.toFixed(2)} s · edição ${formatTime(after)}`
      : 'Transição neste corte');
  };

  const split = useCallback(() => {
    let target = selection;
    if (target?.track === 'transition') target = { track: 'video', id: target.id };
    if (!target) {
      const video = videoClipAt(project, time);
      if (video) target = { track: 'video', id: video.clip.id };
      else {
        const audio = project.audioClips.find((clip) => time >= clip.start && time < clip.start + clipLength(clip));
        const text = project.textClips.find((clip) => time >= clip.start && time < clip.start + clip.duration);
        const overlay = (project.overlayClips || []).find((clip) => time >= clip.start && time < clip.start + clipLength(clip));
        if (audio) target = { track: 'audio', id: audio.id };
        else if (text) target = { track: 'text', id: text.id };
        else if (overlay) target = { track: 'overlay', id: overlay.id };
      }
    }
    if (target) {
      dispatch({ type: 'split', track: target.track, id: target.id, t: time, newId: uid() });
      setCutToken((value) => value + 1);
      announce('Cortado');
    }
  }, [selection, project, time]);

  const remove = useCallback(() => {
    if (!selection) return;
    dispatch({ type: 'delete', ...selection });
    setSelection(null);
  }, [selection]);

  const saveCopy = async () => {
    const saved = await platform.saveProject(JSON.stringify(project, null, 2));
    if (saved?.ok) announce(saved.message || 'Cópia do projeto salva');
    else if (saved?.message) announce(saved.message);
  };

  const save = async () => {
    if (!sessionRef.current?.id || sessionRef.current.ephemeral) {
      try {
        const created = await platform.createProject({ name: projectRef.current.name, project: projectRef.current });
        setSession({ id: created.document.id });
        announce('Projeto criado');
      } catch (error) {
        announce(error.message || 'Falha ao salvar');
      }
      return;
    }
    const result = await flushSave();
    if (result.status === 'error') announce(result.error?.message || 'Falha ao salvar');
    else announce('Salvo');
  };

  const open = async () => {
    try {
      const json = await platform.openProject();
      if (!json) return;
      const saved = await flushSave();
      const imported = await platform.importProjectJson(json);
      // Release only once the switch is certain; a failed import keeps the user here with Ctrl+Z.
      if (saved.status === 'error') removedMediaRef.current = [];
      else releaseRemovedMedia();
      openDocument(imported.document, imported.missing);
      announce('Projeto importado');
    } catch (error) {
      alert('Não foi possível abrir o projeto: ' + error.message);
    }
  };

  const relocateMissing = async (mediaId) => {
    const item = project.media.find((media) => media.id === mediaId);
    if (!item) return;
    const next = await platform.relocateMedia(item);
    if (!next || next.error) {
      if (next?.error) alert(next.error);
      return;
    }
    dispatch({ type: 'replaceMedia', item: { ...item, ...next, id: item.id, missing: false } });
    setMissing((current) => current.filter((entry) => entry.id !== mediaId));
    announce('Mídia localizada');
  };

  const startExport = async (confirmed = false) => {
    if (!project.videoClips.length) return alert('Adicione um vídeo à faixa principal antes de exportar.');
    setPlaying(false);
    let preview;
    try {
      preview = planMainExport(project);
    } catch (error) {
      setExporting({ error: error.message });
      return;
    }
    const visual = androidVisualTransitionWarnings(preview.warnings);
    if (confirmed !== true && visual.length && platform.kind() === 'android') {
      setExporting({ confirm: true, warnings: visual, progress: 0 });
      return;
    }
    setExporting({ progress: 0, warnings: preview.warnings });
    const off = platform.onExportProgress((progress) => setExporting((current) => current && !current.done && !current.error && !current.confirm ? { ...current, progress } : current));
    try {
      const result = await platform.exportVideo(project);
      if (result?.canceled) return setExporting(null);
      setExporting(result?.ok
        ? { done: true, file: result.file, display: result.display, warnings: result.warnings || [], progress: 1 }
        : { error: result?.error || 'A exportação não foi concluída.' });
    } catch (error) {
      setExporting({ error: error.message });
    } finally {
      off();
    }
  };

  useEffect(() => {
    window.__fve = {
      load: (projectData) => {
        dispatch({ type: 'load', project: projectData });
        setSession((current) => (current?.id && !current.ephemeral ? current : { ephemeral: true }));
      },
      createProject: async (name = 'Projeto sem título') => {
        const created = await platform.createProject({ name });
        openDocument(created.document);
        return created.document.id;
      },
      listProjects: () => platform.listProjects(),
      openProjectId: async (id) => {
        const loaded = await platform.loadProject(id);
        openDocument(loaded.document, loaded.missing);
        return { id: loaded.document.id, name: loaded.document.project.name, clips: loaded.document.project.videoClips.length, playhead: loaded.document.playhead, missing: loaded.missing };
      },
      persistNow: () => flushSave(),
      sessionId: () => sessionRef.current?.id || null,
      projectSnapshot: () => ({
        name: projectRef.current.name,
        clips: projectRef.current.videoClips.length,
        duration: projectDuration(projectRef.current),
        overlays: (projectRef.current.overlayClips || []).length,
        texts: projectRef.current.textClips.length,
        audio: projectRef.current.audioClips.length,
        media: projectRef.current.media.length,
        time: timeRef.current,
        playing: playbackRef.current.playing,
        videoIds: projectRef.current.videoClips.map((clip) => clip.id),
        videoCuts: projectRef.current.videoClips.map((clip) => ({ id: clip.id, in: clip.in, out: clip.out, transition: clip.transitionIn?.type || null })),
        textLanes: projectRef.current.textClips.map((clip) => ({ id: clip.id, text: clip.text, start: clip.start, lane: clip.lane || 0 })),
        overlayIds: (projectRef.current.overlayClips || []).map((clip) => clip.id),
        textIds: projectRef.current.textClips.map((clip) => clip.id),
        audioIds: projectRef.current.audioClips.map((clip) => clip.id),
        mediaItems: projectRef.current.media.map((item) => ({ id: item.id, type: item.type, name: item.name })),
      }),
      seek,
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      select: setSelection,
      dispatch,
      voiceSelfTest,
      audioChains: () => [...document.querySelectorAll('video.stage-video')].map(audioChainInfo),
      audioLatency,
    };
  }, [seek]);

  const keyActions = useRef({});
  keyActions.current = { togglePlay, split, remove, seek, time, duration, save, open };
  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      if (!sessionRef.current) return;
      const key = keyActions.current;
      const lower = event.key.toLowerCase();
      if (event.code === 'Space') {
        if (event.repeat) return;
        event.preventDefault();
        event.stopPropagation();
        key.togglePlay();
      }
      else if (event.ctrlKey && lower === 's') { event.preventDefault(); key.save(); }
      else if (event.ctrlKey && lower === 'o') { event.preventDefault(); key.open(); }
      else if ((lower === 's' && !event.ctrlKey && !event.altKey) || (event.ctrlKey && lower === 'b') || (event.ctrlKey && lower === 'k')) { event.preventDefault(); key.split(); }
      else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); key.remove(); }
      else if (event.ctrlKey && lower === 'z' && event.shiftKey) { event.preventDefault(); dispatch({ type: 'redo' }); }
      else if (event.ctrlKey && lower === 'z') { event.preventDefault(); dispatch({ type: 'undo' }); }
      else if (event.ctrlKey && lower === 'y') { event.preventDefault(); dispatch({ type: 'redo' }); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); key.seek(key.time - (event.shiftKey ? 1 : 1 / project.fps)); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); key.seek(key.time + (event.shiftKey ? 1 : 1 / project.fps)); }
      else if (event.key === 'Home') { event.preventDefault(); key.seek(0); }
      else if (event.key === 'End') { event.preventDefault(); key.seek(key.duration); }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [project.fps]);

  const saveLabel = saveInfo.status === 'saving'
    ? 'Salvando…'
    : saveInfo.status === 'error'
      ? 'Falha ao salvar'
      : saveInfo.status === 'saved' && saveInfo.savedAt
        ? `Salvo ${new Date(saveInfo.savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        : '';

  if (!session) {
    return (
      <>
        <HomeScreen
          projects={recents}
          thumbs={thumbs}
          loading={homeLoading}
          mobile={mobile}
          note={platform.persistenceNote()}
          onNew={createAndOpen}
          onNewMedia={createFromPicker}
          onOpenFile={open}
          onOpen={openRecent}
          onRename={async (id, name) => {
            await platform.renameProject(id, name);
            await refreshRecents();
          }}
          onDuplicate={async (id) => {
            await platform.duplicateProject(id);
            await refreshRecents();
            announce('Projeto duplicado');
          }}
          onDelete={async (id) => {
            await platform.deleteProject(id);
            await refreshRecents();
          }}
        />
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  return (
    <div className={`app ${compact ? 'narrow' : ''} ${mobile ? 'mobile' : ''} ${mobile && drawer && sheet === 'tall' ? 'sheet-tall' : ''}`} style={mobile ? { '--stage-ratio': project.height / Math.max(1, project.width) } : undefined}>
      <header className="topbar">
        <div className="brand">
          {compact && !mobile && <button className="icon-button" onClick={() => setDrawer(drawer === 'library' ? null : 'library')} title="Biblioteca">☰</button>}
          <button className="brand-home" onClick={goHome} title="Voltar aos projetos">
            {mobile ? <span className="back-caret" aria-hidden="true">‹</span> : <img src={pixelcutIcon} alt="" />}
            {!mobile && <span className="brand-name">PixelCut</span>}
          </button>
          {mobile ? (
            nameEdit ? (
              <input
                className="project-name-input"
                value={nameDraft}
                aria-label="Nome do projeto"
                autoFocus
                onFocus={(event) => {
                  const el = event.currentTarget;
                  el.scrollLeft = 0;
                  try { el.setSelectionRange(0, el.value.length); } catch { /* some WebViews ignore selection */ }
                }}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => {
                  const name = nameDraft.trim() || 'Projeto sem título';
                  setNameEdit(false);
                  if (name !== project.name) dispatch({ type: 'setName', name });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') { setNameEdit(false); setNameDraft(project.name || ''); }
                }}
              />
            ) : (
              <button
                type="button"
                className="project-name-button"
                title="Toque para renomear"
                onClick={() => { setNameDraft(project.name || ''); setNameEdit(true); }}
              >
                {project.name || 'Projeto sem título'}
              </button>
            )
          ) : (!narrow && <><span className="brand-divider" /><span className="project-title">{project.name || 'Projeto sem título'}</span></>)}
        </div>
        <div className="actions">
          {!mobile && !compact && <button className="header-button" onClick={goHome}>Projetos</button>}
          {!mobile && !compact && <button className="header-button" onClick={open}>Abrir</button>}
          {!mobile && !compact && <button className="header-button" onClick={save}>Salvar</button>}
          {saveLabel && (
            <button
              className={`save-status ${saveInfo.status === 'error' ? 'error' : ''}`}
              onClick={saveInfo.status === 'error' ? save : undefined}
              title={saveInfo.error?.message || saveLabel}
            >
              {saveLabel}
            </button>
          )}
          <button className="history-button" onClick={() => dispatch({ type: 'undo' })} disabled={!state.past.length} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
            <span aria-hidden="true">↶</span>
          </button>
          <button className="history-button" onClick={() => dispatch({ type: 'redo' })} disabled={!state.future.length} title="Refazer (Ctrl+Y)" aria-label="Refazer">
            <span aria-hidden="true">↷</span>
          </button>
          {compact && !mobile && <button className="icon-button" onClick={() => setDrawer(drawer === 'inspector' ? null : 'inspector')} title="Propriedades">⚙</button>}
          <button className="primary export-button" onClick={() => startExport()}>Exportar</button>
          {mobile && <button className="icon-button" aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen((open) => !open)} title="Mais ações">⋯</button>}
        </div>
        {mobile && menuOpen && <button className="drawer-scrim menu-scrim" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}
        {mobile && menuOpen && (
          <div className="header-menu" role="menu">
            <button onClick={() => { setMenuOpen(false); goHome(); }}>Meus projetos</button>
            <button onClick={() => { setMenuOpen(false); importMedia(); }}>Importar mídia</button>
            <button onClick={() => { setMenuOpen(false); open(); }}>Abrir arquivo</button>
            <button onClick={() => { setMenuOpen(false); save(); }}>Salvar</button>
            <button onClick={() => { setMenuOpen(false); saveCopy(); }}>Salvar cópia</button>
            <button onClick={() => { setMenuOpen(false); setSelection(null); setSheet('half'); setDrawer('inspector'); }}>Formato do vídeo</button>
            <button onClick={() => {
              const next = !audioScrub;
              setAudioScrub(next);
              writeAudioScrubPref(next);
              setMenuOpen(false);
              announce(next ? 'Scrubbing sonoro ligado' : 'Scrubbing sonoro desligado');
            }}>{audioScrub ? 'Desligar som ao arrastar' : 'Ligar som ao arrastar'}</button>
          </div>
        )}
      </header>

      <div className="workspace">
        <MediaLibrary
          media={project.media}
          project={project}
          selection={selection}
          time={time}
          playing={playing}
          onPausePlayback={() => setPlaying(false)}
          open={!compact || drawer === 'library'}
          tab={mobile ? libraryTab : undefined}
          onTabChange={mobile ? setLibraryTab : undefined}
          hideTabs={mobile}
          onImport={importMedia}
          onAdd={addToTimeline}
          onAddText={addText}
          onRemove={(id) => {
            const item = project.media.find((media) => media.id === id);
            if (item) removedMediaRef.current.push(item);
            dispatch({ type: 'removeMedia', id });
          }}
          onApplyEffect={applyEffect}
          onApplyTransition={applyTransition}
          onApplyAudioEffect={applyAudioEffect}
        />
        <Preview project={project} time={time} seekVer={seekVer} playing={playing} duration={duration}
          emptyDetail={mobile ? 'Depois, toque em ＋ na biblioteca para colocá-lo na timeline.' : undefined}
          onTime={setTime} onEnd={() => setPlaying(false)} onTogglePlay={togglePlay} onSeek={seek}
          dispatch={dispatch} selection={selection} onSelect={setSelection}
          scrubbing={scrubbing} audioScrub={audioScrub}
          onToggleAudioScrub={() => {
            const next = !audioScrub;
            setAudioScrub(next);
            writeAudioScrubPref(next);
            announce(next ? 'Scrubbing sonoro ligado' : 'Scrubbing sonoro desligado');
          }} />
        <Inspector project={project} selection={selection} dispatch={dispatch} open={!compact || drawer === 'inspector'} />
      </div>

      {compact && drawer && <button className="drawer-scrim" onClick={() => setDrawer(null)} aria-label="Fechar painel" />}

      <Timeline
        project={project}
        time={time}
        duration={duration}
        playing={playing}
        selection={selection}
        onSelect={select}
        onSeek={seek}
        onSeekLive={seekLive}
        onPause={() => setPlaying(false)}
        dispatch={dispatch}
        onSplit={split}
        onDelete={remove}
        onAddText={() => addText()}
        onDropMedia={addToTimeline}
        onDropEffect={applyEffect}
        onDropTransition={applyTransition}
        onDropAudioEffect={applyAudioEffect}
        onUnlink={unlink}
        onImport={importMedia}
        touch={mobile}
        onAdjust={selection ? () => { setSheet('half'); setDrawer('inspector'); } : null}
        onBrowse={() => openCategory('media')}
        onOpenTransitions={() => openCategory('transitions', { toggle: false })}
        cutToken={cutToken}
        onScrubbing={setScrubbing}
        focusToken={seekVer}
      />

      {mobile && (
        <nav className="mobile-dock" aria-label="Ferramentas">
          {[
            ['media', 'Mídia'],
            ['audiofx', 'Áudio'],
            ['text', 'Texto'],
            ['effects', 'Efeitos'],
            ['transitions', 'Transições'],
          ].map(([id, label]) => (
            <button key={id} className={`dock-button ${drawer === 'library' && libraryTab === id ? 'active' : ''}`} onClick={() => openCategory(id)}>{label}</button>
          ))}
        </nav>
      )}

      {mobile && drawer && (
        <div className="sheet-bar">
          <button className="sheet-grab" onClick={() => setSheet((size) => size === 'half' ? 'tall' : 'half')}>{sheet === 'half' ? 'Expandir painel' : 'Reduzir painel'}</button>
          <button className="sheet-close" onClick={() => setDrawer(null)}>Fechar</button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
      <MissingMediaDialog missing={missing} onRelocate={relocateMissing} onContinue={() => setMissing([])} />
      {exporting && <ExportDialog state={exporting} output={`${project.width}×${project.height} · ${project.fps} fps`} onCancel={() => platform.cancelExport()}
        onConfirm={() => startExport(true)}
        onClose={() => setExporting(null)}
        revealLabel={platform.kind() === 'android' ? 'Abrir vídeo' : 'Mostrar na pasta'}
        onShow={platform.canReveal() || platform.kind() === 'android' ? () => {
          const action = platform.kind() === 'android' ? platform.openExport(exporting.file) : platform.showInFolder(exporting.file);
          action.catch((error) => alert(error.message || 'Não foi possível abrir o vídeo.'));
        } : null}
        onShare={platform.kind() === 'android' && exporting.file ? () => platform.shareFile(exporting.file).catch((error) => alert(error.message || 'Não foi possível compartilhar o vídeo.')) : null} />}
    </div>
  );
}
