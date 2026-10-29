import React from 'react';

export default function MissingMediaDialog({ missing, onRelocate, onContinue }) {
  if (!missing?.length) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Mídia ausente</h3>
        <p className="dim">O restante do projeto foi preservado. Localize os arquivos que faltam ou continue com a timeline como está.</p>
        <ul className="missing-list">
          {missing.map((item) => (
            <li key={item.id || item.reason}>
              <span>{item.reason || item.name}</span>
              {item.id && <button onClick={() => onRelocate(item.id)}>Localizar</button>}
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="primary" onClick={onContinue}>Continuar</button>
        </div>
      </div>
    </div>
  );
}
