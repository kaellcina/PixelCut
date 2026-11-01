import React from 'react';

function WarningList({ warnings, lead }) {
  if (!warnings?.length) return null;
  return (
    <>
      {lead ? <p className="dim">{lead}</p> : null}
      <ul className="export-notes">
        {warnings.map((note) => <li key={note}>{note}</li>)}
      </ul>
    </>
  );
}

export default function ExportDialog({ state, onCancel, onClose, onShow, onShare, onConfirm, revealLabel = 'Mostrar na pasta', output }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        {state.error ? (
          <>
            <h3>Exportação falhou</h3>
            <pre className="error">{state.error}</pre>
            <button onClick={onClose}>Fechar</button>
          </>
        ) : state.confirm ? (
          <>
            <h3>Antes de exportar</h3>
            <WarningList warnings={state.warnings} lead="Estas transições ainda não saem no MP4 como na prévia:" />
            <div className="modal-actions">
              <button onClick={onClose}>Cancelar</button>
              <button className="primary" onClick={onConfirm}>Exportar mesmo assim</button>
            </div>
          </>
        ) : state.done ? (
          <>
            <h3>Exportação concluída</h3>
            <p className="dim">{state.display || state.file}</p>
            <WarningList warnings={state.warnings} lead="Isto não entrou no arquivo:" />
            <div className="modal-actions">
              {onShow && <button onClick={onShow}>{revealLabel}</button>}
              {onShare && <button onClick={onShare}>Compartilhar</button>}
              <button className="primary" onClick={onClose}>OK</button>
            </div>
          </>
        ) : (
          <>
            <h3>Exportando MP4…</h3>
            {output && <p className="dim">{output}</p>}
            <WarningList warnings={state.warnings} />
            <div className="progress"><div style={{ width: `${(state.progress * 100).toFixed(1)}%` }} /></div>
            <p>{(state.progress * 100).toFixed(0)}%</p>
            <button onClick={onCancel}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  );
}
