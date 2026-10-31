'use client';
import { createContext, useContext } from 'react';

// Numeração dos jogos e "de onde vem / pra onde vai" (calculado por
// buildMatchGraph em lib/bracketEngine.js e fornecido pela página).
export const GraphContext = createContext(null);

export function JogoTag({ m }) {
  const g = useContext(GraphContext);
  const n = g && m ? g.num[m.id] : null;
  return n ? <div className="jogo-tag">Jogo {n}</div> : null;
}

// Mostra o nome da dupla; se ainda não definida, mostra de onde ela vem.
export function SlotName({ m, side, name }) {
  const g = useContext(GraphContext);
  if (name) return name;
  const src = g && m && g.src[m.id] ? g.src[m.id][side] : null;
  return src ? <span className="slot-src">{src}</span> : '—';
}

export function FwdLine({ m }) {
  const g = useContext(GraphContext);
  const f = g && m ? g.fwd[m.id] : null;
  if (!f || (!f.win && !f.lose)) return null;
  return (
    <div className="fwd-line">
      {f.win && <span>Vencedor → {f.win}</span>}
      {f.win && f.lose && ' · '}
      {f.lose && <span>Perdedor → {f.lose}</span>}
    </div>
  );
}
