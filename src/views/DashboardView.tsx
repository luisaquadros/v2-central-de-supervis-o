import React from 'react';
import {
  Users,
  Play,
  ArrowRight,
  Clock,
  AlertTriangle,
  FileText,
  Calendar,
  CheckCircle2,
  CalendarCheck,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';

interface DashboardViewProps {
  onOpenTurma: (turmaId: string) => void;
  onIniciarSupervisao: (turmaId: string) => void;
  onNavigateToTab: (tab: any, filterParam?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenTurma,
  onIniciarSupervisao,
  onNavigateToTab,
}) => {
  const {
    periodos,
    selectedPeriodoId,
    getTurmasDoPeriodo,
    disciplinas,
    matriculas,
    horariosTurma,
    turmasOrigem,
    orientacoes,
    documentos,
    frequencias,
    registrosSemanais,
    marcosAcademicos,
  } = useSupervisao();

  const currentPeriodo = periodos.find(p => p.periodo_id === selectedPeriodoId);
  const turmas = getTurmasDoPeriodo(selectedPeriodoId);

  // Day of week formatter
  const diasSemanaNome = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];

  // Helper to format schedules for a turma
  const getHorariosDaTurma = (turmaId: string) => {
    return horariosTurma.filter(h => h.turma_id === turmaId && h.ativo);
  };

  // Helper to count enrolled students
  const countAlunosDaTurma = (turmaId: string) => {
    return matriculas.filter(m => m.turma_id === turmaId && m.status === 'MATRICULADO').length;
  };

  // Helper to get Docente Online codes
  const getOrigensDaTurma = (turmaId: string) => {
    return turmasOrigem.filter(o => o.turma_id === turmaId && o.ativo);
  };

  // Pending counts for the selected period
  const turmasIds = turmas.map(t => t.turma_id);
  const matriculasDoPeriodo = matriculas.filter(m => turmasIds.includes(m.turma_id));
  const matriculasIds = matriculasDoPeriodo.map(m => m.matricula_id);

  const orientacoesAbertas = orientacoes.filter(
    o => matriculasIds.includes(o.matricula_id) && o.status === 'ABERTA'
  ).length;

  const docsPendentes = documentos.filter(
    d => matriculasIds.includes(d.matricula_id) && d.status === 'PENDENTE'
  ).length;

  const faltasInjustificadas = frequencias.filter(
    f => matriculasIds.includes(f.matricula_id) && f.status === 'FALTA_SEM_JUSTIFICATIVA'
  ).length;

  const justificativasPendentes = frequencias.filter(
    f => matriculasIds.includes(f.matricula_id) && f.status === 'JUSTIFICATIVA_PENDENTE'
  ).length;

  const registrosFaltantes = registrosSemanais.filter(
    r => matriculasIds.includes(r.matricula_id) && r.status === 'FALTANTE'
  ).length;

  // Marcos acadêmicos do período ordenados por data
  const marcosDoPeriodo = marcosAcademicos
    .filter(m => m.periodo_id === selectedPeriodoId)
    .sort((a, b) => new Date(a.data_prazo).getTime() - new Date(b.data_prazo).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Top Banner Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Painel da Supervisora
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Semestre letivo <span className="font-semibold text-slate-800">{currentPeriodo?.nome}</span> · Supervisão acadêmica de estágios
          </p>
        </div>
      </div>

      {/* 1. SEÇÃO PRINCIPAL: SUAS TURMAS / AULAS */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight uppercase tracking-wider text-[11px]">
              Suas Turmas / Aulas
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {turmas.length} {turmas.length === 1 ? 'turma cadastrada' : 'turmas cadastradas'}
          </span>
        </div>

        {turmas.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
            Nenhuma turma encontrada para o período {currentPeriodo?.nome}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {turmas.map(turma => {
              const disc = disciplinas.find(d => d.disciplina_id === turma.disciplina_id);
              const qtdAlunos = countAlunosDaTurma(turma.turma_id);
              const horarios = getHorariosDaTurma(turma.turma_id);
              const origens = getOrigensDaTurma(turma.turma_id);

              return (
                <div
                  key={turma.turma_id}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Shift & Discipline */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                      <span className="font-semibold text-slate-700">{disc?.nome}</span>
                      <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded text-[10px]">
                        {turma.turno}
                      </span>
                    </div>

                    {/* Class Name */}
                    <h4 className="text-base font-bold text-slate-900 leading-snug">
                      {turma.nome}
                    </h4>

                    {/* Schedule times (from horarios_turma) */}
                    <div className="mt-2.5 space-y-1">
                      {horarios.length > 0 ? (
                        horarios.map(h => (
                          <div
                            key={h.horario_id}
                            className="flex items-center gap-1.5 text-xs text-slate-600"
                          >
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {diasSemanaNome[h.dia_semana]} ·{' '}
                              <span className="font-mono tabular-nums font-medium text-slate-800">
                                {h.hora_inicio} às {h.hora_fim}
                              </span>
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Horário semanal a definir</span>
                        </div>
                      )}
                    </div>

                    {/* Docente Online external codes */}
                    {origens.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                        <span className="text-slate-400">Docente Online:</span>
                        {origens.map(orig => (
                          <span
                            key={orig.origem_id}
                            className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded"
                            title={orig.nome_externo}
                          >
                            {orig.codigo_externo}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bottom Stats & Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{qtdAlunos} alunos</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenTurma(turma.turma_id)}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Abrir Turma
                      </button>
                      <button
                        onClick={() => onIniciarSupervisao(turma.turma_id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer active:scale-98"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Iniciar Supervisão</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. SEÇÃO: PRECISA DA SUA ATENÇÃO (Operacional e Rápida) */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight uppercase tracking-wider text-[11px]">
            Precisa da sua Atenção
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card: Orientações Abertas */}
          <button
            onClick={() => onNavigateToTab('pendencias', 'orientacoes')}
            className="bg-white border border-slate-200 rounded-xl p-3.5 text-left hover:border-slate-300 transition-colors shadow-xs group"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Orientações Abertas</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {orientacoesAbertas}
            </div>
            <div className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Aguardando retorno</span>
            </div>
          </button>

          {/* Card: Documentos Pendentes */}
          <button
            onClick={() => onNavigateToTab('pendencias', 'documentos')}
            className="bg-white border border-slate-200 rounded-xl p-3.5 text-left hover:border-slate-300 transition-colors shadow-xs group"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Documentos Pendentes</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {docsPendentes}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">TCLE, Termos e fichas</div>
          </button>

          {/* Card: Faltas sem Justificativa */}
          <button
            onClick={() => onNavigateToTab('frequencia')}
            className="bg-white border border-slate-200 rounded-xl p-3.5 text-left hover:border-slate-300 transition-colors shadow-xs group"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Faltas Injustificadas</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {faltasInjustificadas}
            </div>
            <div className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>Docente Online</span>
            </div>
          </button>

          {/* Card: Registros Semanais */}
          <button
            onClick={() => onNavigateToTab('pendencias', 'registros')}
            className="bg-white border border-slate-200 rounded-xl p-3.5 text-left hover:border-slate-300 transition-colors shadow-xs group"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Registros Faltantes</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {registrosFaltantes}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Sem entrega registrada</div>
          </button>
        </div>
      </section>

      {/* 3. SEÇÃO: PRÓXIMOS MARCOS ACADÊMICOS */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight uppercase tracking-wider text-[11px]">
            Próximos Marcos e Prazos do Semestre
          </h3>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-xs">
          {marcosDoPeriodo.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Nenhum marco cadastrado para este período.
            </div>
          ) : (
            marcosDoPeriodo.map(marco => {
              const isConcluido = marco.status === 'CONCLUIDO';
              const dataParts = marco.data_prazo.split('-');
              const dataFormatada =
                dataParts.length === 3 ? `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}` : marco.data_prazo;

              return (
                <div
                  key={marco.marco_id}
                  className="p-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        isConcluido
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isConcluido ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <div className={`font-semibold ${isConcluido ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {marco.nome}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {marco.observacao || marco.tipo}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-medium text-slate-700 tabular-nums">
                      {dataFormatada}
                    </div>
                    <span
                      className={`text-[10px] font-medium ${
                        isConcluido ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {isConcluido ? 'Concluído' : 'Pendente'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
