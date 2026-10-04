import React, { useState } from 'react';
import {
  CalendarCheck,
  AlertTriangle,
  Clock,
  Filter,
  CheckCircle2,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { Frequencia } from '../types';

export const FrequenciaView: React.FC<{
  onOpenAluno: (matriculaId: string, initialTab?: string) => void;
}> = ({ onOpenAluno }) => {
  const {
    selectedPeriodoId,
    periodos,
    getTurmasDoPeriodo,
    matriculas,
    alunos,
    frequencias,
    turmasOrigem,
    addFrequencia,
    updateFrequenciaStatus,
  } = useSupervisao();

  const currentPeriodo = periodos.find(p => p.periodo_id === selectedPeriodoId);
  const turmas = getTurmasDoPeriodo(selectedPeriodoId);

  const [selectedTurmaId, setSelectedTurmaId] = useState<string>(() => {
    return turmas.length > 0 ? turmas[0].turma_id : '';
  });

  const [selectedMes, setSelectedMes] = useState<string>('TODOS'); // 'TODOS', '08', '09', '10', '11', '12'
  const [modalNovaFrequencia, setModalNovaFrequencia] = useState(false);

  // New frequency state
  const [novaDataAula, setNovaDataAula] = useState(new Date().toISOString().split('T')[0]);
  const [novaOrigemId, setNovaOrigemId] = useState('');

  const activeTurma = turmas.find(t => t.turma_id === selectedTurmaId);
  const origensDaTurma = turmasOrigem.filter(o => o.turma_id === selectedTurmaId && o.ativo);

  // Filter matriculas in selected turma
  const matriculasTurma = matriculas.filter(
    m => m.turma_id === selectedTurmaId && m.status === 'MATRICULADO'
  );
  const matriculasIds = matriculasTurma.map(m => m.matricula_id);

  // Filter frequencies by month if selected
  const frequenciasFiltradas = frequencias.filter(f => {
    if (!matriculasIds.includes(f.matricula_id)) return false;
    if (selectedMes !== 'TODOS') {
      const mesRegistro = f.data_aula.split('-')[1];
      if (mesRegistro !== selectedMes) return false;
    }
    return true;
  });

  // Calculate unexcused absences per student: { aluno, matricula, count, dates: [] }
  const alunosComFaltaInjustificada = matriculasTurma
    .map(m => {
      const al = alunos.find(a => a.aluno_id === m.aluno_id);
      const faltas = frequenciasFiltradas.filter(
        f => f.matricula_id === m.matricula_id && f.status === 'FALTA_SEM_JUSTIFICATIVA'
      );
      const pendentes = frequenciasFiltradas.filter(
        f => f.matricula_id === m.matricula_id && f.status === 'JUSTIFICATIVA_PENDENTE'
      );
      return {
        matricula: m,
        aluno: al,
        faltasCount: faltas.length,
        datasFaltas: faltas.map(f => f.data_aula),
        pendentesCount: pendentes.length,
      };
    })
    .filter(item => item.faltasCount > 0 || item.pendentesCount > 0)
    .sort((a, b) => b.faltasCount - a.faltasCount);

  // Registro de frequência estrito: sem presunção automática de presença
  const [matriculasSelecionadas, setMatriculasSelecionadas] = useState<string[]>([]);
  const [statusParaLancar, setStatusParaLancar] = useState<Frequencia['status']>('PRESENTE');

  // Handle register for verified students
  const handleLancarFrequenciaGeral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaDataAula || matriculasSelecionadas.length === 0) return;

    // Registra estritamente para os alunos confirmados pelo usuário
    matriculasSelecionadas.forEach(matId => {
      addFrequencia(matId, novaDataAula, statusParaLancar, '', novaOrigemId);
    });

    setMatriculasSelecionadas([]);
    setModalNovaFrequencia(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Controle de Frequência
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Semestre {currentPeriodo?.nome} · Mapeamento integrado ao Docente Online
          </p>
        </div>

        <button
          onClick={() => setModalNovaFrequencia(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Lançar Nova Aula</span>
        </button>
      </div>

      {/* Filters: Período -> Turma -> Mês */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">Filtrar:</span>
        </div>

        {/* Turma filter */}
        <select
          value={selectedTurmaId}
          onChange={e => setSelectedTurmaId(e.target.value)}
          className="border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 font-medium focus:outline-none"
        >
          {turmas.map(t => (
            <option key={t.turma_id} value={t.turma_id}>
              {t.nome} ({t.turno})
            </option>
          ))}
        </select>

        {/* Mês filter */}
        <select
          value={selectedMes}
          onChange={e => setSelectedMes(e.target.value)}
          className="border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 font-medium focus:outline-none"
        >
          <option value="TODOS">Todos os meses</option>
          <option value="08">Agosto</option>
          <option value="09">Setembro</option>
          <option value="10">Outubro</option>
          <option value="11">Novembro</option>
          <option value="12">Dezembro</option>
        </select>

        {/* Active Docente Online codes for this class */}
        {origensDaTurma.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>Docente Online:</span>
            {origensDaTurma.map(o => (
              <span key={o.origem_id} className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                {o.codigo_externo}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 1. SEÇÃO DESTAQUE: ALUNOS COM FALTA SEM JUSTIFICATIVA */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Alunos com Faltas sem Justificativa ou Pendentes
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {alunosComFaltaInjustificada.length} alunos com pendência
          </span>
        </div>

        {alunosComFaltaInjustificada.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            Nenhum aluno com falta sem justificativa registrado nesta turma para o filtro selecionado.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {alunosComFaltaInjustificada.map(item => (
              <div
                key={item.matricula.matricula_id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{item.aluno?.nome}</span>
                    <span className="font-mono text-slate-400 text-[11px]">
                      {item.aluno?.identificador_academico}
                    </span>
                  </div>

                  {/* List of absence dates */}
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {item.faltasCount > 0 && (
                      <span className="text-red-700 font-bold">
                        {item.faltasCount} falta(s) sem justificativa:
                      </span>
                    )}
                    {item.datasFaltas.map((d, i) => (
                      <span
                        key={i}
                        className="font-mono bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-[11px]"
                      >
                        {d}
                      </span>
                    ))}
                    {item.pendentesCount > 0 && (
                      <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-[11px] font-medium">
                        {item.pendentesCount} justificativa pendente de envio
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onOpenAluno(item.matricula.matricula_id, 'frequencia')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-semibold text-slate-700 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  Justificar / Analisar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. TABELA COMPLETA DE REGISTROS DESTE PERÍODO */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Histórico de Lançamentos de Aula</h3>
        {frequenciasFiltradas.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            Nenhuma frequência lançada para esta turma no filtro selecionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                  <th className="py-2.5">Data da Aula</th>
                  <th className="py-2.5">Aluno</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5">Docente Online</th>
                  <th className="py-2.5">Justificativa</th>
                  <th className="py-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {frequenciasFiltradas.map(freq => {
                  const mat = matriculasTurma.find(m => m.matricula_id === freq.matricula_id);
                  const al = mat ? alunos.find(a => a.aluno_id === mat.aluno_id) : null;
                  const origem = turmasOrigem.find(o => o.origem_id === freq.origem_id);

                  return (
                    <tr key={freq.frequencia_id} className="hover:bg-slate-50">
                      <td className="py-3 font-mono font-bold text-slate-800">{freq.data_aula}</td>
                      <td className="py-3 font-semibold text-slate-900">{al?.nome || '—'}</td>
                      <td className="py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            freq.status === 'PRESENTE'
                              ? 'bg-emerald-100 text-emerald-900'
                              : freq.status === 'FALTA_JUSTIFICADA'
                              ? 'bg-blue-100 text-blue-900'
                              : freq.status === 'JUSTIFICATIVA_PENDENTE'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-red-100 text-red-900'
                          }`}
                        >
                          {freq.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-[11px] text-slate-500">
                        {origem ? origem.codigo_externo : '—'}
                      </td>
                      <td className="py-3 text-slate-600 max-w-xs truncate">
                        {freq.justificativa || '—'}
                      </td>
                      <td className="py-3 text-right">
                        <select
                          value={freq.status}
                          onChange={e =>
                            updateFrequenciaStatus(
                              freq.frequencia_id,
                              e.target.value as any,
                              freq.justificativa
                            )
                          }
                          className="border border-slate-200 rounded p-1 text-[11px] bg-white text-slate-800"
                        >
                          <option value="PRESENTE">Presente</option>
                          <option value="FALTA_SEM_JUSTIFICATIVA">Falta s/ just.</option>
                          <option value="FALTA_JUSTIFICADA">Falta justificada</option>
                          <option value="JUSTIFICATIVA_PENDENTE">Just. pendente</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Lançar Nova Aula */}
      {modalNovaFrequencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 text-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Lançar Frequência da Aula</h3>
            <p className="text-slate-500">
              Turma: <span className="font-semibold text-slate-800">{activeTurma?.nome}</span> (
              {matriculasTurma.length} alunos)
            </p>

            <form onSubmit={handleLancarFrequenciaGeral} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Data da Aula</label>
                <input
                  type="date"
                  required
                  value={novaDataAula}
                  onChange={e => setNovaDataAula(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Status a Registrar</label>
                <select
                  value={statusParaLancar}
                  onChange={e => setStatusParaLancar(e.target.value as Frequencia['status'])}
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-xs font-semibold"
                >
                  <option value="PRESENTE">Presente</option>
                  <option value="FALTA_SEM_JUSTIFICATIVA">Falta sem Justificativa</option>
                  <option value="FALTA_JUSTIFICADA">Falta Justificada</option>
                  <option value="JUSTIFICATIVA_PENDENTE">Justificativa Pendente</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 block">Estudantes a Lançar ({matriculasSelecionadas.length}/{matriculasTurma.length})</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (matriculasSelecionadas.length === matriculasTurma.length) {
                        setMatriculasSelecionadas([]);
                      } else {
                        setMatriculasSelecionadas(matriculasTurma.map(m => m.matricula_id));
                      }
                    }}
                    className="text-[11px] text-blue-600 underline font-medium cursor-pointer"
                  >
                    {matriculasSelecionadas.length === matriculasTurma.length ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-white">
                  {matriculasTurma.map(m => {
                    const al = alunos.find(a => a.aluno_id === m.aluno_id);
                    const isSelected = matriculasSelecionadas.includes(m.matricula_id);
                    return (
                      <label key={m.matricula_id} className="flex items-center gap-2 text-xs text-slate-800 p-1 hover:bg-slate-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) {
                              setMatriculasSelecionadas(prev => [...prev, m.matricula_id]);
                            } else {
                              setMatriculasSelecionadas(prev => prev.filter(id => id !== m.matricula_id));
                            }
                          }}
                          className="rounded border-slate-300"
                        />
                        <span className="font-medium">{al?.nome || 'Estudante'}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({al?.identificador_academico})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Código de Origem (Docente Online)
                </label>
                <select
                  value={novaOrigemId}
                  onChange={e => setNovaOrigemId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50"
                >
                  <option value="">Todos / Padrão da turma</option>
                  {origensDaTurma.map(o => (
                    <option key={o.origem_id} value={o.origem_id}>
                      {o.codigo_externo} - {o.nome_externo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNovaFrequencia(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800"
                >
                  Lançar Presenças
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
