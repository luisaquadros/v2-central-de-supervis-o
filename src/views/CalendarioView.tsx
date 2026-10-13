import React, { useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { useNavegacao } from '../context/NavegacaoContext';
import { dataLocal, feriadoNacional, formatarDataBr, somarDias, DIAS_SEMANA_NOMES } from '../services/supervisaoOperacionalService';
import { Botao, Cartao, Selo, Vazio } from '../components/ui';

function inicioDaSemana(iso: string): string {
  const dia = dataLocal(iso).getDay();
  return somarDias(iso, dia === 0 ? -6 : 1 - dia); // segunda-feira
}

/** Agenda semanal de todas as turmas: aulas, leituras, feriados e prazos. */
export const CalendarioView: React.FC = () => {
  const { hojeIso, getAulasDoDia, getLeiturasDoEncontro, getResponsaveisLeitura, marcosAcademicos, getTurmasDoPeriodo } = useSupervisao();
  const { abrirTurma, abrirAula, abrirPreparar } = useNavegacao();
  const [segunda, setSegunda] = useState(() => inicioDaSemana(hojeIso));
  const [turmaFiltro, setTurmaFiltro] = useState('');
  const turmas = getTurmasDoPeriodo();
  const ids = new Set(turmas.map(t => t.turma_id));

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => somarDias(segunda, i)).map(data => ({
    data,
    feriado: feriadoNacional(data),
    aulas: getAulasDoDia(data).filter(a => !turmaFiltro || a.turma.turma_id === turmaFiltro),
    prazos: marcosAcademicos.filter(m => m.data_prazo === data && (!m.turma_id || ids.has(m.turma_id)) && (!turmaFiltro || !m.turma_id || m.turma_id === turmaFiltro)),
  })).filter(d => d.aulas.length > 0 || d.prazos.length > 0 || d.feriado), [segunda, getAulasDoDia, marcosAcademicos, turmaFiltro]);

  const fimSemana = somarDias(segunda, 6);

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Calendário</h1>
          <p className="text-slate-600">Semana de {formatarDataBr(segunda)} a {formatarDataBr(fimSemana)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {turmas.length > 1 && (
            <select value={turmaFiltro} onChange={e => setTurmaFiltro(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">
              <option value="">Todas as turmas</option>
              {turmas.map(t => <option key={t.turma_id} value={t.turma_id}>{t.nome}</option>)}
            </select>
          )}
          <Botao tamanho="sm" onClick={() => setSegunda(s => somarDias(s, -7))} aria-label="Semana anterior" icone={<ChevronLeft className="w-4 h-4" />} />
          <Botao tamanho="sm" onClick={() => setSegunda(inicioDaSemana(hojeIso))}>Esta semana</Botao>
          <Botao tamanho="sm" onClick={() => setSegunda(s => somarDias(s, 7))} aria-label="Próxima semana" icone={<ChevronRight className="w-4 h-4" />} />
        </div>
      </header>

      {dias.length === 0 ? <Cartao><Vazio titulo="Nada nesta semana" /></Cartao> : dias.map(d => (
        <Cartao key={d.data} className={`p-4 ${d.data === hojeIso ? 'ring-2 ring-slate-900' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            <p className="font-bold text-slate-900">{DIAS_SEMANA_NOMES[dataLocal(d.data).getDay()]}, {formatarDataBr(d.data)}</p>
            {d.data === hojeIso && <Selo cor="azul">hoje</Selo>}
            {d.feriado && <Selo cor="ambar">{d.feriado}</Selo>}
          </div>
          <ul className="space-y-2">
            {d.aulas.map(a => {
              const leituras = getLeiturasDoEncontro(a.turma.turma_id, d.data);
              return (
                <li key={a.turma.turma_id} className="flex flex-col sm:flex-row sm:items-center gap-2 border-t border-slate-100 pt-2">
                  <div className="flex-1 min-w-0">
                    <button onClick={() => abrirTurma(a.turma.turma_id, 'aulas')} className="font-semibold text-slate-900 hover:underline cursor-pointer text-left">
                      {a.horaInicio && <span className="text-slate-500 font-normal mr-2">{a.horaInicio}</span>}{a.turma.nome}
                    </button>
                    {a.situacao !== 'PREVISTA'
                      ? <p className="text-sm text-amber-800">{a.situacao === 'REAGENDADA' ? `Reagendada para ${formatarDataBr(a.dataReagendada)}` : a.motivo}</p>
                      : leituras.map(l => (
                        <p key={l.leitura_id} className="text-sm text-slate-700 flex gap-1.5">
                          <BookOpen className="w-4 h-4 mt-0.5 text-violet-600 shrink-0" />
                          <span>{l.tema}{getResponsaveisLeitura(l).length > 0 && <span className="text-slate-500"> — {getResponsaveisLeitura(l).map(r => r.nome).join(', ')}</span>}</span>
                        </p>
                      ))}
                  </div>
                  {a.situacao === 'PREVISTA' && (
                    <div className="flex gap-2">
                      {d.data >= hojeIso && <Botao tamanho="sm" variante="fantasma" onClick={() => abrirPreparar(a.turma.turma_id, d.data)}>Preparar</Botao>}
                      {d.data <= hojeIso && (
                        <Botao tamanho="sm" variante={a.chamadaSalva ? 'fantasma' : 'primario'} onClick={() => abrirAula(a.turma.turma_id, d.data)}>
                          {a.chamadaSalva ? 'Chamada ✓' : 'Chamada'}
                        </Botao>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {d.prazos.map(m => (
              <li key={m.marco_id} className="flex items-center gap-2 text-sm text-slate-800 border-t border-slate-100 pt-2">
                <Flag className="w-4 h-4 text-red-500" /> {m.nome}
              </li>
            ))}
          </ul>
        </Cartao>
      ))}
    </div>
  );
};
