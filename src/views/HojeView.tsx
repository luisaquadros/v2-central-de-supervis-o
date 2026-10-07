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
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { calcularMetricasCronogramaRss } from '../services/supervisaoOperacionalService';

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
    situacaoAtualTurmas,
    avaliacoesCompletas,
    getSupervisaoAtual,
    getProximaSupervisao,
    getPendenciasOperacionais,
  } = useSupervisao();

  const supervisaoAtual = getSupervisaoAtual();
  const proximaSupervisao = getProximaSupervisao();
  const pendenciasAtencao = getPendenciasOperacionais();

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
  const hojeStr = new Date().toISOString().split('T')[0];

  // RSS & Cronograma Semanal: Calculado canonicamente com filtragem estrita por turma_id
  const metricasCronograma = React.useMemo(() => {
    return calcularMetricasCronogramaRss(
      turmaEmDestaque?.turma_id,
      calendarioRss,
      situacaoAtualTurmas,
      hojeStr
    );
  }, [turmaEmDestaque, calendarioRss, situacaoAtualTurmas, hojeStr]);

  const semanaDePraticaTexto = metricasCronograma.semanaTexto;
  const semanasEncerradasTexto = metricasCronograma.semanasEncerradasTexto;

  // Status de RSS: Consome exclusivamente os cabeçalhos reais de status_rss_unidades (status_rss, saldo_rss)
  const statusFiltrados = turmaEmDestaque
    ? statusRssUnidades.filter(s => s.turma_id === turmaEmDestaque.turma_id)
    : statusRssUnidades;

  const unidadesComRssPendente = statusFiltrados.filter(
    s => s.status_rss === 'PENDENTE' || s.status_rss === 'ATRASADO' || s.status_rss === 'CRITICO' || (s.saldo_rss !== undefined && Number(s.saldo_rss) < 0)
  ).length;

  const alunosRssEmDia = statusFiltrados.length > 0
    ? statusFiltrados.filter(s => s.status_rss === 'EM_DIA' || (s.saldo_rss !== undefined && Number(s.saldo_rss) >= 0)).length
    : (totalAlunosAtivos > 0 ? Math.max(0, totalAlunosAtivos - unidadesComRssPendente) : null);

  // Frequência
  const faltasInjustificadas = frequencias.filter(f => f.status === 'FALTA_SEM_JUSTIFICATIVA').length;
  const justificativasPendentes = frequencias.filter(f => f.status === 'JUSTIFICATIVA_PENDENTE').length;
  const frequenciasParaRevisar = faltasInjustificadas + justificativasPendentes;

  // Documentos
  const docsPendentes = documentos.filter(d => d.status === 'PENDENTE').length;
  const docsCompletos = documentos.filter(d => d.status === 'ENTREGUE').length;

  // Avaliação Semestral: cálculo real a partir de avaliacoesCompletas e matrículas
  const totalMatriculas = matriculas.filter(m => m.status === 'MATRICULADO').length;
  const totalAvaliados = avaliacoesCompletas.filter(
    a => a.status === 'AVALIADA' || a.status === 'ENVIADO' || a.status === 'APROVADO_ENVIO'
  ).length;
  const percentualAvaliacao = totalMatriculas > 0
    ? Math.round((totalAvaliados / totalMatriculas) * 100)
    : null;

  // Orientações abertas
  const orientacoesAbertas = orientacoes.filter(o => o.status === 'ABERTA');

  // Próxima Leitura vinculada à data e turma (sem índice arbitrário)
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
      {/* 1. AGORA: Supervisão em andamento, Chamada pendente ou Informativo */}
      {supervisaoAtual.emAndamento && supervisaoAtual.turma && (
        <div className="bg-slate-900 border-2 border-amber-400 rounded-2xl p-5 text-white shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span className="text-xs uppercase tracking-wider font-bold text-amber-400">
                  Supervisão em Andamento
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mt-1">
                {supervisaoAtual.turma.nome} — Turno {supervisaoAtual.turma.turno}
              </h3>
              <p className="text-sm text-slate-300 font-mono mt-0.5">
                Horário: {supervisaoAtual.horaInicio}–{supervisaoAtual.horaFim}
              </p>
            </div>
            <button
              onClick={() => onIniciarSupervisao(supervisaoAtual.turma!.turma_id)}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all self-start sm:self-auto"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Entrar na Supervisão</span>
            </button>
          </div>
        </div>
      )}

      {supervisaoAtual.chamadaPendenteHoje && supervisaoAtual.turma && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 text-red-950 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>Chamada Pendente</span>
              </div>
              <h3 className="text-lg font-bold text-red-950 mt-1">
                {supervisaoAtual.turma.nome}
              </h3>
              <p className="text-xs text-red-800 mt-0.5">
                A supervisão encerrou às {supervisaoAtual.horaFim}, mas a chamada ainda não foi salva.
              </p>
            </div>
            <button
              onClick={() => onIniciarSupervisao(supervisaoAtual.turma!.turma_id)}
              className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs self-start sm:self-auto"
            >
              <UserCheck className="w-4 h-4" />
              <span>Finalizar Chamada</span>
            </button>
          </div>
        </div>
      )}

      {supervisaoAtual.naoRealizadaHoje && supervisaoAtual.turma && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-amber-900">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-800">
            <Calendar className="w-4 h-4 text-amber-700" />
            <span>Hoje: Aula Não Realizada</span>
          </div>
          <h4 className="text-sm font-bold text-slate-900 mt-1">{supervisaoAtual.turma.nome}</h4>
          <p className="text-xs text-amber-800 mt-0.5">
            Não haverá supervisão — <strong>{supervisaoAtual.motivoNaoRealizada || 'Feriado/Recesso'}</strong>.{' '}
            {supervisaoAtual.observacaoNaoRealizada && `(${supervisaoAtual.observacaoNaoRealizada})`}
          </p>
        </div>
      )}

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
                Semana de Prática: <strong className="text-slate-800">{semanaDePraticaTexto}</strong>
              </span>
              <span>•</span>
              <span>
                Semanas RSS Encerradas: <strong className="text-slate-800">{semanasEncerradasTexto}</strong>
              </span>
              {metricasCronograma.conflitoIdentificado && (
                <span
                  className="text-[10px] text-amber-800 bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded font-semibold cursor-help"
                  title={metricasCronograma.avisoInconsistencia || 'Inconsistência entre datas do calendário e semana atual'}
                >
                  ⚠ Inconsistência na base
                </span>
              )}
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
          <div className="text-2xl font-black text-slate-900 font-mono">
            {semanaDePraticaTexto}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {metricasCronograma.semanasEncerradas !== null
              ? `${metricasCronograma.semanasEncerradas} semana(s) já encerrada(s)`
              : 'Aguardando cronograma'}
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
          <div className="text-2xl font-black text-slate-900 font-mono">{totalAlunosAtivos > 0 ? totalAlunosAtivos : '—'}</div>
          <div className="mt-2 text-xs text-slate-500">
            {turmasAtivas.length > 0 ? `Distribuídos em ${turmasAtivas.length} turmas ativas` : 'Nenhuma turma ativa'}
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
          <div className="text-2xl font-black text-slate-900 font-mono">
            {statusFiltrados.length > 0 ? (
              <>
                {unidadesComRssPendente}{' '}
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-sans">
                  pendências
                </span>
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>{alunosRssEmDia !== null ? `${alunosRssEmDia} em dia` : 'Aguardando sincronização'}</span>
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
          <div className="text-2xl font-black text-slate-900 font-mono">
            {frequencias.length > 0 ? frequenciasParaRevisar : '—'}{' '}
            <span className="text-xs font-bold text-slate-500 font-sans">situações</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {faltasInjustificadas} sem justificativa • {justificativasPendentes} pendentes
          </div>
        </button>
      </div>

      {/* 2. PRECISA DA SUA ATENÇÃO (Somente Itens Acionáveis) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Precisa da sua Atenção
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {pendenciasAtencao.length} item(ns) acionável(is)
          </span>
        </div>

        {pendenciasAtencao.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            <CheckCircle className="w-7 h-7 text-emerald-500 mx-auto mb-1.5 opacity-80" />
            <p className="font-bold text-slate-700 text-sm">Tudo em dia!</p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Não há chamadas pendentes, justificativas aguardando análise ou prazos vencidos.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendenciasAtencao.slice(0, 6).map(item => (
              <div
                key={item.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase shrink-0 ${
                      item.urgencia === 'CRITICA'
                        ? 'bg-red-100 text-red-800'
                        : item.urgencia === 'ALTA'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {item.tipo}
                  </span>
                  <div>
                    <span className="font-bold text-slate-900 block">{item.titulo}</span>
                    <span className="text-slate-600 text-[11px] mt-0.5 block">{item.descricao}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (item.tipo === 'CHAMADA' && item.turma_id) {
                      onIniciarSupervisao(item.turma_id);
                    } else {
                      onNavigateToTab(item.targetTab, item.targetParam);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 text-xs shrink-0 self-start sm:self-auto cursor-pointer flex items-center gap-1"
                >
                  <span>Resolver</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

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
          <div className="text-2xl font-black text-slate-900 font-mono">
            {documentos.length === 0 ? (
              '—'
            ) : docsPendentes > 0 ? (
              <span className="text-amber-600">{docsPendentes} pendentes</span>
            ) : (
              <span className="text-emerald-700">{docsCompletos} entregues</span>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {documentos.length === 0 ? 'Aguardando sincronização' : `${docsCompletos} entregues e conferidos`}
          </div>
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
          <div className="text-2xl font-black text-slate-900 font-mono">{orientacoesAbertas.length}</div>
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
          <div className="text-2xl font-black text-slate-900 font-mono">
            {percentualAvaliacao !== null ? (
              <>
                {percentualAvaliacao}% <span className="text-xs font-bold text-slate-400 font-sans">preenchida</span>
              </>
            ) : (
              '—'
            )}
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
          <div className="text-2xl font-black text-slate-900 font-mono">{tarefasPendentesFila} itens</div>
          <div className="mt-2 text-xs text-slate-500">Tarefas prioritárias da supervisora</div>
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
