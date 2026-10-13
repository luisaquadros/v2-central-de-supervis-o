import React, { useMemo, useState } from 'react';
import { BookOpen, GraduationCap, Search, Users } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { useNavegacao } from '../context/NavegacaoContext';
import { textoComparavel } from '../services/normalizacaoPlanilha';
import { formatarDataBr } from '../services/supervisaoOperacionalService';
import { Janela } from './ui';

/** Busca única (Ctrl+K): estudantes, turmas e leituras do semestre. */
export const BuscaGlobalModal: React.FC = () => {
  const { getTurmasDoPeriodo, getAlunosDaTurma, leiturasResponsaveis, getGrupoDoAluno } = useSupervisao();
  const { fecharBusca, abrirAluno, abrirTurma } = useNavegacao();
  const [termo, setTermo] = useState('');
  const turmas = getTurmasDoPeriodo();
  const q = textoComparavel(termo);

  const resultados = useMemo(() => {
    if (q.length < 2) return { estudantes: [], turmas: [], leituras: [] };
    const ids = new Set(turmas.map(t => t.turma_id));
    return {
      estudantes: turmas.flatMap(t => getAlunosDaTurma(t.turma_id).map(a => ({ ...a, turma: t })))
        .filter(a => textoComparavel(a.aluno.nome).includes(q) || textoComparavel(a.aluno.email).includes(q))
        .slice(0, 8),
      turmas: turmas.filter(t => textoComparavel(t.nome).includes(q)).slice(0, 4),
      leituras: leiturasResponsaveis.filter(l => ids.has(l.turma_id || '') && (textoComparavel(l.tema).includes(q) || textoComparavel(l.responsavel_nome).includes(q))).slice(0, 5),
    };
  }, [q, turmas, getAlunosDaTurma, leiturasResponsaveis]);

  const ir = (fn: () => void) => { fn(); fecharBusca(); };
  const total = resultados.estudantes.length + resultados.turmas.length + resultados.leituras.length;

  return (
    <Janela titulo="Buscar" aoFechar={fecharBusca}>
      <div className="relative mb-3">
        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input autoFocus value={termo} onChange={e => setTermo(e.target.value)} placeholder="Nome do estudante, turma ou leitura…"
          className="w-full rounded-xl border border-slate-300 pl-10 pr-3 py-3 text-base focus:outline-2 focus:outline-slate-900" />
      </div>
      {q.length >= 2 && total === 0 && <p className="text-slate-500 text-center py-6">Nada encontrado para “{termo}”.</p>}
      <ul className="space-y-1">
        {resultados.estudantes.map(e => (
          <li key={e.matricula.matricula_id}>
            <button onClick={() => ir(() => abrirAluno(e.matricula.matricula_id))} className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 cursor-pointer">
              <GraduationCap className="w-5 h-5 text-slate-400" />
              <span className="flex-1"><span className="font-semibold text-slate-900">{e.aluno.nome}</span>
                <span className="block text-sm text-slate-500">{e.turma.nome}{getGrupoDoAluno(e.matricula.matricula_id) ? ` · ${getGrupoDoAluno(e.matricula.matricula_id)?.nome_grupo}` : ''}</span></span>
            </button>
          </li>
        ))}
        {resultados.turmas.map(t => (
          <li key={t.turma_id}>
            <button onClick={() => ir(() => abrirTurma(t.turma_id))} className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 cursor-pointer">
              <Users className="w-5 h-5 text-slate-400" /><span className="font-semibold text-slate-900">{t.nome}</span>
            </button>
          </li>
        ))}
        {resultados.leituras.map(l => (
          <li key={l.leitura_id}>
            <button onClick={() => ir(() => abrirTurma(l.turma_id || '', 'leituras'))} className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 cursor-pointer">
              <BookOpen className="w-5 h-5 text-slate-400" />
              <span><span className="font-semibold text-slate-900">{l.tema}</span><span className="block text-sm text-slate-500">{formatarDataBr(l.data)} · {turmas.find(t => t.turma_id === l.turma_id)?.nome}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </Janela>
  );
};
