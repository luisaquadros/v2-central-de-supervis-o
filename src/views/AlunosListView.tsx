import React, { useState } from 'react';
import { Search, GraduationCap, Users, X, ChevronRight } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';

interface AlunosListViewProps {
  onOpenAluno: (matriculaId: string) => void;
}

export const AlunosListView: React.FC<AlunosListViewProps> = ({ onOpenAluno }) => {
  const {
    selectedPeriodoId,
    periodos,
    getTurmasDoPeriodo,
    matriculas,
    alunos,
    disciplinas,
    getResumoAlunoSupervisao,
  } = useSupervisao();

  const [search, setSearch] = useState('');
  const [selectedTurmaFilter, setSelectedTurmaFilter] = useState('ALL');

  const currentPeriodo = periodos.find(p => p.periodo_id === selectedPeriodoId);
  const turmas = getTurmasDoPeriodo(selectedPeriodoId);
  const turmasIds = turmas.map(t => t.turma_id);

  // Filter matriculas in current period
  const matriculasDoPeriodo = matriculas.filter(m => turmasIds.includes(m.turma_id));

  const items = matriculasDoPeriodo
    .map(m => {
      const al = alunos.find(a => a.aluno_id === m.aluno_id);
      const tu = turmas.find(t => t.turma_id === m.turma_id);
      const di = tu ? disciplinas.find(d => d.disciplina_id === tu.disciplina_id) : null;
      const resumo = getResumoAlunoSupervisao(m.matricula_id);
      return { matricula: m, aluno: al, turma: tu, disciplina: di, resumo };
    })
    .filter(item => item.aluno !== undefined && item.turma !== undefined)
    .filter(item => {
      if (selectedTurmaFilter !== 'ALL' && item.turma?.turma_id !== selectedTurmaFilter) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          item.aluno!.nome.toLowerCase().includes(query) ||
          item.aluno!.identificador_academico.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => a.aluno!.nome.localeCompare(b.aluno!.nome));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Lista de Alunos</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Semestre {currentPeriodo?.nome} · {items.length} alunos matriculados
          </p>
        </div>

        {/* Filter by Turma */}
        <div className="flex items-center gap-2">
          <select
            value={selectedTurmaFilter}
            onChange={e => setSelectedTurmaFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg p-2 bg-white text-slate-800 font-medium"
          >
            <option value="ALL">Todas as turmas</option>
            {turmas.map(t => (
              <option key={t.turma_id} value={t.turma_id}>
                {t.nome} ({t.turno})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar aluno por nome ou RA..."
          className="w-full pl-9 pr-8 py-2.5 text-xs bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-xs"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Students List */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-xs">
        {items.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhum aluno encontrado para os filtros selecionados.
          </div>
        ) : (
          items.map(({ matricula, aluno, turma, disciplina, resumo }) => {
            return (
              <div
                key={matricula.matricula_id}
                onClick={() => onOpenAluno(matricula.matricula_id)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors cursor-pointer select-none text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                    {aluno!.nome.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{aluno!.nome}</span>
                      {resumo?.temAtencao && (
                        <span className="text-amber-500 font-bold" title="Requer atenção">
                          ⚠
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      <span className="font-mono text-slate-400">
                        {aluno!.identificador_academico}
                      </span>{' '}
                      · {turma?.nome} ({turma?.turno}) · {disciplina?.nome}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Registros</span>
                    <span className="font-mono font-bold text-slate-900">
                      {resumo?.totalRegistrosEntregues} / 12
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Faltas</span>
                    <span
                      className={`font-mono font-bold ${
                        resumo?.faltasInjustificadasCount ? 'text-red-600' : 'text-slate-900'
                      }`}
                    >
                      {resumo?.faltasInjustificadasCount || 0}
                    </span>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
