import React, { useEffect, useState } from 'react';
import { aspectOf } from '../catalog.js';
import { formatTime } from '../store.js';
import pixelcutIcon from '../../assets/icon.png';

function formatEdited(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function ratioLabel(item) {
  return aspectOf({ width: item.width, height: item.height }).name || `${item.width}×${item.height}`;
}

export default function HomeScreen({
  projects,
  thumbs,
  loading,
  mobile,
  note,
  onNew,
  onNewMedia,
  onOpenFile,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}) {
  const [menu, setMenu] = useState(null);
  const [rename, setRename] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  const openMenu = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ id: item.id, x: event.clientX, y: event.clientY });
  };

  const startRename = (item) => {
    setMenu(null);
    setRename(item.id);
    setDraft(item.name || '');
  };

  const applyRename = () => {
    if (rename && draft.trim()) onRename(rename, draft.trim());
    setRename(null);
  };

  return (
    <div className={`home ${mobile ? 'mobile' : ''}`}>
      <header className="home-top">
        <div className="brand">
          <img src={pixelcutIcon} alt="" />
          <span className="brand-name">PixelCut</span>
        </div>
        <div className="home-actions">
          <button className="header-button" onClick={onOpenFile}>Abrir</button>
          {onNew ? <button className="header-button" onClick={onNew}>{mobile ? 'Em branco' : 'Projeto em branco'}</button> : null}
          <button className="primary" onClick={onNewMedia || onNew}>{mobile ? 'Novo vídeo' : 'Novo com mídia'}</button>
        </div>
      </header>

      <main className="home-body">
        <div className="home-heading">
          <div>
            <p className="home-kicker">Projetos</p>
            <h1>Recentes</h1>
          </div>
          <button className="primary home-new" onClick={onNewMedia || onNew}>{mobile ? 'Novo vídeo' : 'Novo com mídia'}</button>
        </div>

        {loading ? (
          <p className="home-status">Carregando projetos…</p>
        ) : !projects.length ? (
          <div className="home-empty">
            <img src={pixelcutIcon} alt="" />
            <strong>Comece um projeto</strong>
            <span>{mobile
              ? 'Toque em Novo vídeo para escolher fotos e vídeos. Se cancelar, nenhum projeto é criado.'
              : 'Importe os arquivos primeiro. A timeline já recebe os clipes. Nada é criado se você cancelar a seleção.'}</span>
            <div className="home-empty-actions">
              <button className="primary" onClick={onNewMedia || onNew}>{mobile ? 'Novo vídeo' : 'Novo com mídia'}</button>
              {onNew ? <button className="secondary-button" onClick={onNew}>Projeto em branco</button> : null}
              <button className="secondary-button" onClick={onOpenFile}>Abrir existente</button>
            </div>
          </div>
        ) : (
          <div className="home-grid">
            {projects.map((item) => (
              <article
                key={item.id}
                className="home-card"
                onClick={() => onOpen(item.id)}
                onContextMenu={(event) => openMenu(event, item)}
              >
                <div className={`home-thumb ${thumbs[item.id] ? '' : 'placeholder'}`}>
                  {thumbs[item.id] ? <img src={thumbs[item.id]} alt="" /> : <span>PixelCut</span>}
                </div>
                <div className="home-card-body">
                  {rename === item.id ? (
                    <input
                      value={draft}
                      autoFocus
                      aria-label="Nome do projeto"
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={applyRename}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') applyRename();
                        if (event.key === 'Escape') setRename(null);
                      }}
                    />
                  ) : (
                    <h2>{item.name}</h2>
                  )}
                  <p>{ratioLabel(item)} · {formatTime(item.duration)} · {formatEdited(item.updatedAt)}</p>
                  <button className="home-more" title="Mais ações" onClick={(event) => openMenu(event, item)}>⋯</button>
                </div>
              </article>
            ))}
          </div>
        )}
        {note ? <p className="home-note">{note}</p> : null}
      </main>

      {menu && (
        <div className="home-menu" style={{ left: Math.min(menu.x, window.innerWidth - 180), top: Math.min(menu.y, window.innerHeight - 140) }} role="menu">
          <button onClick={() => { const item = projects.find((entry) => entry.id === menu.id); if (item) startRename(item); }}>Renomear</button>
          <button onClick={() => { setMenu(null); onDuplicate(menu.id); }}>Duplicar</button>
          <button className="danger" onClick={() => { setConfirmId(menu.id); setMenu(null); }}>Excluir</button>
        </div>
      )}

      {confirmId && (
        <div className="modal-backdrop" onClick={() => setConfirmId(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Excluir projeto?</h3>
            <p className="dim">Isso apaga o projeto da lista. As mídias originais no disco não são removidas.</p>
            <div className="modal-actions">
              <button onClick={() => setConfirmId(null)}>Cancelar</button>
              <button className="primary" onClick={() => { onDelete(confirmId); setConfirmId(null); }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
