import React from 'react';

export default function ExportDialog({ state, onCancel, onClose, onShow, onShare, revealLabel = 'Mostrar na pasta', output }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        {state.error ? (
          <>
            <h3>Exportação falhou</h3>
            <pre className="error">{state.error}</pre>
            <button onClick={onClose}>Fechar</button>
          </>
        ) : state.done ? (
          <>
            <h3>Exportação concluída</h3>
            <p className="dim">{state.display || state.file}</p>
            {state.warnings?.length ? (
              <>
                <p className="dim">Isto não entrou no arquivo:</p>
                <ul className="export-notes">
                  {state.warnings.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </>
            ) : null}
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
            <div className="progress"><div style={{ width: `${(state.progress * 100).toFixed(1)}%` }} /></div>
            <p>{(state.progress * 100).toFixed(0)}%</p>
            <button onClick={onCancel}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  );
}
