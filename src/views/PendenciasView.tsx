import React, { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import type { ItemPendenciaOperacional } from '../types';
import { PendenciaItem } from '../components/PendenciaItem';
import { TarefasLista } from '../components/TarefasLista';
import { Secao, Vazio } from '../components/ui';

const GRUPOS: { titulo: string; tipos: ItemPendenciaOperacional['tipo'][] }[] = [
  { titulo: 'Chamadas', tipos: ['CHAMADA'] },
  { titulo: 'Faltas', tipos: ['JUSTIFICATIVA', 'RISCO_FALTAS'] },
  { titulo: 'Documentos', tipos: ['DOCUMENTO_CONFERIR', 'DOCUMENTO'] },
  { titulo: 'Estudo dirigido', tipos: ['ESTUDO_DIRIGIDO'] },
  { titulo: 'Devolutivas', tipos: ['DEVOLUTIVA'] },
];

/**
 * Tudo o que precisa de uma ação sua, cada item com o botão que o resolve.
 * RSS não aparece aqui: fica dentro de cada turma (aba RSS).
 */
export const PendenciasView: React.FC = () => {
  const { pendencias, getTurmasDoPeriodo } = useSupervisao();
  const [turmaFiltro, setTurmaFiltro] = useState('');
  const turmas = getTurmasDoPeriodo();

  const filtradas = useMemo(
    () => pendencias.filter(p => !turmaFiltro || p.turma_id === turmaFiltro),
    [pendencias, turmaFiltro]
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Pendências</h1>
          <p className="text-slate-600">Só o que precisa de uma ação sua. O RSS fica dentro de cada turma.</p>
        </div>
        {turmas.length > 1 && (
          <select value={turmaFiltro} onChange={e => setTurmaFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold">
            <option value="">Todas as turmas</option>
            {turmas.map(t => <option key={t.turma_id} value={t.turma_id}>{t.nome}</option>)}
          </select>
        )}
      </header>

      {filtradas.length === 0 ? (
        <Secao titulo="Pendências">
          <Vazio icone={<CheckCircle2 className="w-8 h-8 text-emerald-500" />} titulo="Nada pendente" texto="Quando algo precisar de você, aparece aqui com o botão para resolver." />
        </Secao>
      ) : (
        GRUPOS.map(g => {
          const itens = filtradas.filter(p => g.tipos.includes(p.tipo));
          if (itens.length === 0) return null;
          return (
            <section key={g.titulo} className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{g.titulo} ({itens.length})</h2>
              <ul className="space-y-2">{itens.map(p => <PendenciaItem key={p.id} item={p} mostrarTurma={!turmaFiltro} />)}</ul>
            </section>
          );
        })
      )}

      <Secao titulo="Meus lembretes">
        <TarefasLista />
      </Secao>
    </div>
  );
};
