import React, { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { normalizarNota, formatarNotaParaExibicao } from '../utils/gradeUtils';
import { DevolutivaModal, INSTRUMENTO_DEVOLUTIVA, SeloDevolutiva } from '../components/DevolutivaModal';
import { Abas, Botao, Cartao, Vazio } from '../components/ui';

/**
 * Avaliação do semestre por turma: quadro de notas (aba avaliacoes, por critério da turma)
 * e devolutivas (aba avaliacoes_completas), com envio pelo Gmail.
 */
export const AvaliacaoView: React.FC = () => {
  const { getTurmasDoPeriodo, getAlunosDaTurma, getCriteriosDaTurma, avaliacoes, saveAvaliacao, avaliacoesCompletas, proximaSupervisao } = useSupervisao();
  const turmas = getTurmasDoPeriodo();
  const [turmaId, setTurmaId] = useState(proximaSupervisao?.turma.turma_id || turmas[0]?.turma_id || '');
  const [aba, setAba] = useState<'notas' | 'devolutivas'>('notas');
  const [devolutiva, setDevolutiva] = useState<string | null>(null);

  useEffect(() => {
    if (turmas.length && !turmas.some(t => t.turma_id === turmaId)) setTurmaId(turmas[0].turma_id);
  }, [turmas, turmaId]);

  const alunos = getAlunosDaTurma(turmaId);
  const criterios = getCriteriosDaTurma(turmaId);
  const maximo = criterios.reduce((s, c) => s + (Number(String(c.nota_maxima).replace(',', '.')) || 0), 0);
  const notaDe = (matriculaId: string, criterioId: string) => avaliacoes.find(a => a.matricula_id === matriculaId && a.criterio_id === criterioId);
  const totalDe = (matriculaId: string) => criterios.reduce((s, c) => {
    const n = normalizarNota(notaDe(matriculaId, c.criterio_id)?.nota);
    return typeof n === 'number' ? s + n : s;
  }, 0);
  const lancadas = alunos.reduce((s, a) => s + criterios.filter(c => typeof normalizarNota(notaDe(a.matricula.matricula_id, c.criterio_id)?.nota) === 'number').length, 0);
  const devolutivaDe = (matriculaId: string) => avaliacoesCompletas.find(a => a.matricula_id === matriculaId && a.instrumento_id === INSTRUMENTO_DEVOLUTIVA);
  const enviadas = alunos.filter(a => devolutivaDe(a.matricula.matricula_id)?.status === 'ENVIADO').length;

  if (turmas.length === 0) return <Cartao><Vazio icone={<Award className="w-8 h-8" />} titulo="Nenhuma turma neste semestre" /></Cartao>;

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Avaliação</h1>
          <p className="text-slate-600">
            Notas lançadas: <strong>{lancadas}</strong> de {alunos.length * criterios.length} · Devolutivas enviadas: <strong>{enviadas}</strong> de {alunos.length}
          </p>
        </div>
        <select value={turmaId} onChange={e => setTurmaId(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold">
          {turmas.map(t => <option key={t.turma_id} value={t.turma_id}>{t.nome}</option>)}
        </select>
      </header>

      <Abas abas={[{ id: 'notas', rotulo: 'Quadro de notas' }, { id: 'devolutivas', rotulo: 'Devolutivas', contador: alunos.length - enviadas }]} ativa={aba} aoMudar={setAba} />

      {aba === 'notas' && (
        criterios.length === 0 ? <Cartao><Vazio titulo="Sem critérios de avaliação para esta turma" texto="Os critérios vêm da aba criterios_avaliacao da planilha." /></Cartao> : (
          <Cartao className="p-2 sm:p-4 overflow-x-auto">
            <table className="text-sm border-separate border-spacing-y-1 min-w-full">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="px-2 sticky left-0 bg-white">Estudante</th>
                  {criterios.map(c => (
                    <th key={c.criterio_id} className="px-1 font-semibold text-center min-w-20" title={c.criterio_descricao || c.nome}>
                      <span className="block leading-tight">{c.nome}</span>
                      <span className="text-xs font-normal text-slate-400">máx. {formatarNotaParaExibicao(c.nota_maxima)}</span>
                    </th>
                  ))}
                  <th className="px-2 text-center">Total{maximo > 0 && <span className="block text-xs font-normal text-slate-400">de {formatarNotaParaExibicao(maximo)}</span>}</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map(({ matricula, aluno }) => (
                  <tr key={matricula.matricula_id}>
                    <td className="px-2 sticky left-0 bg-white font-medium text-slate-900 whitespace-nowrap">{aluno.nome}</td>
                    {criterios.map(c => {
                      const atual = notaDe(matricula.matricula_id, c.criterio_id);
                      const max = Number(String(c.nota_maxima).replace(',', '.')) || Infinity;
                      return (
                        <td key={c.criterio_id} className="px-1">
                          <input
                            key={`${c.criterio_id}-${atual?.nota ?? ''}`}
                            defaultValue={atual?.nota !== undefined && String(atual.nota) !== '' ? String(atual.nota).replace('.', ',') : ''}
                            inputMode="decimal"
                            aria-label={`${aluno.nome}: ${c.nome}`}
                            className="w-full min-w-16 rounded-lg border border-slate-300 px-2 py-2 text-center"
                            onBlur={e => {
                              const n = normalizarNota(e.target.value);
                              if (typeof n !== 'number') return;
                              if (n > max) { e.target.value = String(atual?.nota ?? '').replace('.', ','); return; }
                              if (n !== Number(atual?.nota)) void saveAvaliacao(matricula.matricula_id, c.criterio_id, n, atual?.observacao);
                            }}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 text-center font-bold text-slate-900">{formatarNotaParaExibicao(totalDe(matricula.matricula_id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-sm text-slate-500 mt-2 px-2">Digite a nota e saia do campo para salvar. Use vírgula para decimais. Notas acima do máximo são recusadas.</p>
          </Cartao>
        )
      )}

      {aba === 'devolutivas' && (
        <Cartao className="p-4">
          <ul className="divide-y divide-slate-100">
            {alunos.map(({ matricula, aluno }) => {
              const d = devolutivaDe(matricula.matricula_id);
              return (
                <li key={matricula.matricula_id} className="py-2.5 flex flex-wrap items-center gap-2">
                  <span className="flex-1 min-w-48 font-medium text-slate-900">{aluno.nome}</span>
                  <span className="text-sm text-slate-600 w-20">{formatarNotaParaExibicao(totalDe(matricula.matricula_id))}</span>
                  <SeloDevolutiva status={d?.status} />
                  <Botao tamanho="sm" variante={d?.status === 'ENVIADO' ? 'fantasma' : 'primario'} onClick={() => setDevolutiva(matricula.matricula_id)}>
                    {d ? (d.status === 'ENVIADO' ? 'Ver' : 'Continuar') : 'Escrever'}
                  </Botao>
                </li>
              );
            })}
          </ul>
        </Cartao>
      )}

      {devolutiva && <DevolutivaModal matriculaId={devolutiva} aoFechar={() => setDevolutiva(null)} />}
    </div>
  );
};
