import React from 'react';
import {
  Play,
  Calendar,
  Clock,
  BookOpen,
  AlertTriangle,
  FileText,
  CheckCircle,
  Users,
  Award,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Layers,
  ChevronRight,
  Bell,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';

interface HojeViewProps {
  onOpenTurma: (turmaId: string) => void;
  onIniciarSupervisao: (turmaId: string) => void;
  onNavigateToTab: (tab: any, param?: string) => void;
  onOpenPrepararAula?: (turmaId: string) => void;
}

export const HojeView: React.FC<HojeViewProps> = ({
  onOpenTurma,
  onIniciarSupervisao,
  onNavigateToTab,
  onOpenPrepararAula,
}) => {
  const {
    turmas,
    alunos,
    matriculas,
    orientacoes,
    documentos,
    registrosSemanais,
    frequencias,
    horariosTurma,
    leiturasResponsaveis,
    statusRssUnidades,
    regrasRss,
    calendarioRss,
    marcosAcademicos,
    selectedPeriodoId,
    filaProfessora,
  } = useSupervisao();

  // Filtragem de turmas do período ativo
  const turmasAtivas = turmas.filter(
    t => (t.periodo_id === selectedPeriodoId || !selectedPeriodoId) && t.status !== 'ARQUIVADO'
  );

  // Turma prioritária para supervisão hoje / próxima supervisão
  const turmaEmDestaque = turmasAtivas[0];
  const horarioDestaque = turmaEmDestaque
    ? horariosTurma.find(h => h.turma_id === turmaEmDestaque.turma_id)
    : undefined;

  // Cálculos consolidados da base
  const totalAlunosAtivos = alunos.filter(a => a.status === 'ATIVO').length;

  // RSS: Consome exclusivamente os dados materializados das tabelas oficiais
  const regraTurmaDestaque = turmaEmDestaque ? regrasRss.find(r => r.turma_id === turmaEmDestaque.turma_id) : undefined;
  const semanasCalendario = calendarioRss.map(c => Number(c.semana) || 0).filter(s => s > 0);
  const totalSemanasPeriodo = regraTurmaDestaque?.total_esperado ? Number(regraTurmaDestaque.total_esperado) : (semanasCalendario.length > 0 ? Math.max(...semanasCalendario) : 0);
  const semanaAtual = semanasCalendario.length > 0 ? Math.max(...semanasCalendario) : 0;
  const semanasEncerradas = Math.max(0, semanaAtual - 1);

  // Status de RSS: Consome exclusivamente os cabeçalhos reais de status_rss_unidades (status_rss, saldo_rss)
  const unidadesComRssPendente = statusRssUnidades.filter(
    s => s.status_rss === 'PENDENTE' || s.status_rss === 'ATRASADO' || s.status_rss === 'CRITICO' || (s.saldo_rss !== undefined && Number(s.saldo_rss) < 0)
  ).length;

  const alunosRssEmDia = statusRssUnidades.length > 0
    ? statusRssUnidades.filter(s => s.status_rss === 'EM_DIA' || (s.saldo_rss !== undefined && Number(s.saldo_rss) >= 0)).length
    : Math.max(0, totalAlunosAtivos - unidadesComRssPendente);

  // Frequência
  const faltasInjustificadas = frequencias.filter(f => f.status === 'FALTA_SEM_JUSTIFICATIVA').length;
  const justificativasPendentes = frequencias.filter(f => f.status === 'JUSTIFICATIVA_PENDENTE').length;
  const frequenciasParaRevisar = faltasInjustificadas + justificativasPendentes;

  // Documentos
  const docsPendentes = documentos.filter(d => d.status === 'PENDENTE').length;
  const docsCompletos = documentos.filter(d => d.status === 'ENTREGUE').length;

  // Orientações abertas
  const orientacoesAbertas = orientacoes.filter(o => o.status === 'ABERTA');

  // Próxima Leitura vinculada à data e turma (sem índice arbitrário)
  const hojeStr = new Date().toISOString().split('T')[0];
  const proximaLeitura = leiturasResponsaveis.find(
    l => (l.data || '') >= hojeStr && (!turmaEmDestaque || l.turma_id === turmaEmDestaque.turma_id)
  ) || leiturasResponsaveis.find(l => (l.data || '') >= hojeStr) || null;

  // Tarefas da fila da professora
  const tarefasPendentesFila = filaProfessora.filter((i: any) => i.status !== 'CONCLUIDO').length;

  // Mudanças desde a última supervisão (calculadas a partir dos registros mais recentes)
  const rssRecentes = registrosSemanais.filter(r => r.data_entrega && r.data_entrega >= hojeStr).length;
  const docsRecentes = documentos.filter(d => d.data_entrega && d.data_entrega >= hojeStr).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner: Central Operacional & Próxima Supervisão */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Próxima Supervisão Agendada
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {turmaEmDestaque ? turmaEmDestaque.nome : 'Nenhuma turma ativa'}
              </h1>
              {turmaEmDestaque && (
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold font-mono">
                  {horarioDestaque ? `${horarioDestaque.hora_inicio} às ${horarioDestaque.hora_fim}` : 'Horário regular'}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Semana de Prática: <strong className="text-slate-800">{semanaAtual} / {totalSemanasPeriodo}</strong>
              </span>
              <span>•</span>
              <span>
                Semanas RSS Encerradas: <strong className="text-slate-800">{semanasEncerradas}</strong>
              </span>
              {proximaLeitura && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 text-indigo-700 font-semibold">
                    <BookOpen className="w-3.5 h-3.5" />
                    Leitura: "{proximaLeitura.tema || proximaLeitura.titulo || 'Texto'}" (
                    {proximaLeitura.responsavel_nome || proximaLeitura.responsavel_id || 'Geral'})
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Action Button for Supervision Mode */}
          {turmaEmDestaque && (
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {onOpenPrepararAula && (
                <button
                  onClick={() => onOpenPrepararAula(turmaEmDestaque.turma_id)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Preparar Aula</span>
                </button>
              )}

              <button
                onClick={() => onIniciarSupervisao(turmaEmDestaque.turma_id)}
                className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2.5 cursor-pointer shadow-xs"
              >
                <Play className="w-4 h-4 fill-current text-emerald-400" />
                <span>Iniciar Supervisão / Modo Aula</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid of Objective Clickable Operational Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* SEMANA & PRÁTICA */}
        <button
          onClick={() => onNavigateToTab('calendario')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-xs text-left transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Semana de Prática</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {semanaAtual} <span className="text-sm font-normal text-slate-400">/ {totalSemanasPeriodo}</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {semanasEncerradas} semanas já encerradas
          </div>
        </button>

        {/* ALUNOS ATIVOS */}
        <button
          onClick={() => onNavigateToTab('alunos')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-xs text-left transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Estudantes Ativos</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalAlunosAtivos}</div>
          <div className="mt-2 text-xs text-slate-500">
            Distribuídos em {turmasAtivas.length} turmas ativas
          </div>
        </button>

        {/* RSS (Semanas Encerradas vs Pendências) */}
        <button
          onClick={() => onNavigateToTab('pendencias', 'rss')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-amber-300 hover:shadow-xs text-left transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Registros Semanais (RSS)</span>
            <FileText className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {unidadesComRssPendente}{' '}
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              pendências
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>{alunosRssEmDia} em dia</span>
            <span className="text-slate-400">semana atual aberta</span>
          </div>
        </button>

        {/* FREQUÊNCIA */}
        <button
          onClick={() => onNavigateToTab('pendencias', 'faltas')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-red-300 hover:shadow-xs text-left transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Frequência</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {frequenciasParaRevisar}{' '}
            <span className="text-xs font-bold text-slate-500">situações</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {faltasInjustificadas} sem justificativa • {justificativasPendentes} pendentes
          </div>
        </button>
      </div>

      {/* Second Row of Cards: Documentos, Orientações, Avaliação, Minha Fila */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* DOCUMENTOS */}
        <button
          onClick={() => onNavigateToTab('pendencias', 'documentos')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-left transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Documentos</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {docsPendentes > 0 ? (
              <span className="text-amber-600">{docsPendentes} pendentes</span>
            ) : (
              <span className="text-emerald-700">100% em dia</span>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500">{docsCompletos} entregues e conferidos</div>
        </button>

        {/* ORIENTAÇÕES ABERTAS */}
        <button
          onClick={() => onNavigateToTab('pendencias', 'orientacoes')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-left transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Orientações Abertas</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{orientacoesAbertas.length}</div>
          <div className="mt-2 text-xs text-slate-500">Para retomar na supervisão</div>
        </button>

        {/* CENTRAL DE AVALIAÇÃO */}
        <button
          onClick={() => onNavigateToTab('avaliacao')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-left transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Avaliação Semestral</span>
            <Award className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            71% <span className="text-xs font-bold text-slate-400">preenchida</span>
          </div>
          <div className="mt-2 text-xs text-indigo-600 font-semibold group-hover:underline flex items-center gap-1">
            <span>Abrir Central de Avaliação</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </button>

        {/* MINHA FILA DA PROFESSORA */}
        <button
          onClick={() => onNavigateToTab('pendencias')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-left transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Fila da Professora</span>
            <Bell className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{tarefasPendentesFila} itens</div>
          <div className="mt-2 text-xs text-slate-500">Tarefas de 5, 15 e 30+ minutos</div>
        </button>
      </div>

      {/* Quick Operational Sections: Próximas Aulas & Mudanças Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximas Supervisões por Turma */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <span>Turmas em Acompanhamento</span>
            </h2>
            <button
              onClick={() => onNavigateToTab('turmas')}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Ver todas as turmas →
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {turmasAtivas.map(t => {
              const horario = horariosTurma.find(h => h.turma_id === t.turma_id);
              const totalAlunos = matriculas.filter(m => m.turma_id === t.turma_id && m.status === 'MATRICULADO').length;

              return (
                <div key={t.turma_id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900 hover:text-indigo-600 cursor-pointer" onClick={() => onOpenTurma(t.turma_id)}>
                      {t.nome}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {horario ? `${horario.hora_inicio} - ${horario.hora_fim}` : 'Horário acadêmico'} • {totalAlunos} estudantes
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenTurma(t.turma_id)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                    >
                      Detalhes
                    </button>
                    <button
                      onClick={() => onIniciarSupervisao(t.turma_id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Play className="w-3 h-3 fill-current text-emerald-400" />
                      <span>Modo Aula</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mudanças Desde a Última Supervisão */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Mudanças Desde a Última Supervisão</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400">Timestamps oficiais</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">RSS Recebidos Recentemente</span>
              <span className="text-lg font-bold text-slate-900">+{rssRecentes} entregas</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Documentos Enviados</span>
              <span className="text-lg font-bold text-slate-900">+{docsRecentes} arquivos</span>
            </div>
          </div>

          {/* Orientações Recentes */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Orientações Mais Recentes
            </span>
            {orientacoes.slice(0, 3).map(o => (
              <div key={o.orientacao_id} className="p-2.5 rounded-lg bg-slate-50 text-xs border border-slate-100 flex items-center justify-between gap-2">
                <span className="truncate text-slate-700 font-medium">"{o.texto}"</span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {new Date(o.data_hora).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
