import React, { useMemo, useState } from 'react';
import { GraduationCap, Search } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { useNavegacao } from '../context/NavegacaoContext';
import { textoComparavel } from '../services/normalizacaoPlanilha';
import { Cartao, CLASSE_INPUT, Selo, Vazio } from '../components/ui';

type Filtro = 'todos' | 'atencao' | 'faltas' | 'rss';

/** Todos os estudantes do semestre, com filtros rápidos por situação. */
export const AlunosListView: React.FC = () => {
  const { getTurmasDoPeriodo, getAlunosDaTurma, getResumoAlunoSupervisao, periodoAtual } = useSupervisao();
  const { abrirAluno } = useNavegacao();
  const [busca, setBusca] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const turmas = getTurmasDoPeriodo();

  const itens = useMemo(() => turmas
    .filter(t => !turmaId || t.turma_id === turmaId)
    .flatMap(t => getAlunosDaTurma(t.turma_id).map(a => ({ ...a, turma: t, r: getResumoAlunoSupervisao(a.matricula.matricula_id) })))
    .filter(i => !busca || textoComparavel(i.aluno.nome).includes(textoComparavel(busca)) || textoComparavel(i.aluno.email).includes(textoComparavel(busca)))
    .filter(i => filtro === 'todos'
      || (filtro === 'atencao' && i.r?.temAtencao)
      || (filtro === 'faltas' && (i.r?.faltasInjustificadasCount || 0) > 0)
      || (filtro === 'rss' && i.r?.situacaoRss?.estaAtrasado))
    .sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome)),
  [turmas, turmaId, busca, filtro, getAlunosDaTurma, getResumoAlunoSupervisao]);

  const FILTROS: [Filtro, string][] = [['todos', 'Todos'], ['atencao', 'Com alerta'], ['faltas', 'Com faltas'], ['rss', 'RSS atrasado']];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-black text-slate-900">Estudantes</h1>
        <p className="text-slate-600">Semestre {periodoAtual?.nome} · {itens.length} na lista</p>
      </header>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-56">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className={`${CLASSE_INPUT} pl-9`} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome ou e-mail…" />
        </div>
        <select value={turmaId} onChange={e => setTurmaId(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold">
          <option value="">Todas as turmas</option>
          {turmas.map(t => <option key={t.turma_id} value={t.turma_id}>{t.nome}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map(([id, rotulo]) => (
          <button key={id} onClick={() => setFiltro(id)} className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${filtro === id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-700'}`}>{rotulo}</button>
        ))}
      </div>
      <Cartao className="p-2 sm:p-4">
        {itens.length === 0 ? <Vazio icone={<GraduationCap className="w-8 h-8" />} titulo="Ninguém encontrado" /> : (
          <ul className="divide-y divide-slate-100">
            {itens.map(({ matricula, aluno, turma, r }) => (
              <li key={matricula.matricula_id}>
                <button onClick={() => abrirAluno(matricula.matricula_id)} className="w-full text-left py-2.5 px-2 flex flex-wrap items-center gap-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <span className="flex-1 min-w-48">
                    <span className="font-semibold text-slate-900">{aluno.nome}</span>
                    <span className="block text-sm text-slate-500">{turma.nome}</span>
                  </span>
                  {r && r.faltasInjustificadasCount > 0 && <Selo cor="vermelho">{r.faltasInjustificadasCount} falta(s)</Selo>}
                  {r?.situacaoRss?.estaAtrasado && <Selo cor="ambar">RSS −{Math.abs(r.situacaoRss.saldoRss)}</Selo>}
                  {r && r.docsPendentesCount > 0 && <Selo cor="ambar">{r.docsPendentesCount} doc.</Selo>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
};
