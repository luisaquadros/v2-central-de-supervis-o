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
  UserCheck,
  BookOpen,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { NavTab } from '../types';

interface DashboardViewProps {
  onOpenTurma: (turmaId: string) => void;
  onIniciarSupervisao: (turmaId: string) => void;
  onNavigateToTab: (tab: NavTab, filterParam?: string) => void;
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
    marcosAcademicos,
    leiturasResponsaveis,
    encontrosTurma,
    getSupervisaoAtual,
    getProximaSupervisao,
    getPendenciasCanonicas,
  } = useSupervisao();

  const currentPeriodo = periodos.find(p => p.periodo_id === selectedPeriodoId);
  const turmas = getTurmasDoPeriodo(selectedPeriodoId);

  const hojeIso = new Date().toISOString().split('T')[0];
  const supervisaoAtual = getSupervisaoAtual();
  const proximaSupervisao = getProximaSupervisao();
  const pendenciasAtencao = getPendenciasCanonicas();

  // Prazos finais de hoje e próximos marcos acadêmicos
  const prazosHoje = marcosAcademicos.filter(
    m => m.data_prazo === hojeIso && m.status !== 'CONCLUIDO'
  );
  const proximosMarcos = marcosAcademicos
    .filter(m => m.data_prazo && m.data_prazo > hojeIso && m.status !== 'CONCLUIDO')
    .sort((a, b) => a.data_prazo.localeCompare(b.data_prazo))
    .slice(0, 4);

  // Leituras e estudos dirigidos previstos para hoje
  const estudosDirigidosHoje = leiturasResponsaveis.filter(
    l => l.data === hojeIso && turmas.some(t => t.turma_id === l.turma_id)
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* HEADER OPERACIONAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Painel Operacional da Supervisora
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Semestre letivo <strong className="text-slate-800">{currentPeriodo?.nome}</strong> · Supervisão clínica e acadêmica
          </p>
        </div>
      </div>

      {/* 1. SEÇÃO: AGORA (Supervisão em andamento, Chamada pendente ou Informativo) */}
      <section className="space-y-3">
        {supervisaoAtual.emAndamento && supervisaoAtual.turma ? (
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
        ) : supervisaoAtual.chamadaPendenteHoje && supervisaoAtual.turma ? (
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 text-red-950 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Chamada Pendente</span>
                </div>
                <h3 className="text-lg font-bold text-red-950 mt-1">
                  {supervisaoAtual.turma.nome} — Turno {supervisaoAtual.turma.turno}
                </h3>
                <p className="text-xs text-red-800 mt-0.5">
                  A supervisão de hoje encerrou às {supervisaoAtual.horaFim}, mas a chamada ainda não foi salva.
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
        ) : supervisaoAtual.naoRealizadaHoje && supervisaoAtual.turma ? (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-amber-900">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-800">
              <Calendar className="w-4 h-4 text-amber-700" />
              <span>Hoje: Aula Não Realizada</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 mt-1">
              {supervisaoAtual.turma.nome}
            </h4>
            <p className="text-xs text-amber-800 mt-0.5">
              Não haverá supervisão — <strong>{supervisaoAtual.motivoNaoRealizada || 'Feriado/Recesso'}</strong>.{' '}
              {supervisaoAtual.observacaoNaoRealizada && `(${supervisaoAtual.observacaoNaoRealizada})`}
            </p>
          </div>
        ) : null}
      </section>

      {/* 2. GRID PRINCIPAL: HOJE × PRÓXIMA SUPERVISÃO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CARD: HOJE */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Hoje ({hojeIso})
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">Programação do dia</span>
          </div>

          {/* Supervisão de hoje se houver */}
          {supervisaoAtual.turma ? (
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[11px] text-slate-500">Supervisão:</span>
              <div className="font-bold text-slate-900 text-sm">
                {supervisaoAtual.turma.nome} ({supervisaoAtual.horaInicio}–{supervisaoAtual.horaFim})
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-1">
              Nenhuma supervisão regular agendada para o dia de hoje.
            </p>
          )}

          {/* Estudos Dirigidos / Leituras de Hoje */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Estudo Dirigido / Leitura Prevista
            </span>
            {estudosDirigidosHoje.length === 0 ? (
              <p className="text-xs text-slate-400">
                Nenhum estudo dirigido programado para hoje.
              </p>
            ) : (
              <div className="space-y-1.5">
                {estudosDirigidosHoje.map((est, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs"
                  >
                    <div className="font-bold text-slate-900">
                      {est.tema || est.artigo_leitura}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Responsável: <strong>{est.responsavel_nome || 'Estudante titular'}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prazos Finais de Hoje */}
          {prazosHoje.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1 mb-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Prazos que Vencem Hoje!</span>
              </span>
              <div className="space-y-1">
                {prazosHoje.map(p => (
                  <div key={p.marco_id} className="text-xs text-red-900 font-semibold">
                    • {p.nome}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CARD: PRÓXIMA SUPERVISÃO */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Próxima Supervisão
              </h3>
            </div>
            {proximaSupervisao && (
              <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                Em {proximaSupervisao.diasAte === 0 ? 'hoje' : `${proximaSupervisao.diasAte} dia(s)`}
              </span>
            )}
          </div>

          {!proximaSupervisao ? (
            <p className="text-xs text-slate-400 py-4">
              Nenhuma supervisão agendada nos próximos 14 dias.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  {proximaSupervisao.turma.nome}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {proximaSupervisao.diaSemanaNome} · <strong className="font-mono text-slate-800">{proximaSupervisao.dataProxima}</strong>
                </p>
                <p className="text-xs font-mono text-slate-700 mt-1 font-semibold">
                  Horário: {proximaSupervisao.horaInicio}–{proximaSupervisao.horaFim}
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => onIniciarSupervisao(proximaSupervisao.turma.turma_id)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Acessar Modo Supervisão</span>
                </button>
                <button
                  onClick={() => onOpenTurma(proximaSupervisao.turma.turma_id)}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Ver Turma
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. SEÇÃO: PRECISA DA SUA ATENÇÃO (Somente Itens Acionáveis) */}
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
          <div className="p-8 text-center text-xs text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-bold text-slate-700 text-sm">Tudo regularizado!</p>
            <p className="text-slate-400 mt-0.5">
              Não há chamadas pendentes, justificativas aguardando análise ou prazos vencidos.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendenciasAtencao.map(item => (
              <div
                key={item.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50 px-2 rounded-lg transition-colors"
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

      {/* 4. SEÇÃO: PRÓXIMOS PRAZOS (Marcos Acadêmicos Relevantes) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Próximos Prazos e Marcos Acadêmicos
            </h3>
          </div>
          <button
            onClick={() => onNavigateToTab('calendario')}
            className="text-xs text-blue-600 hover:underline font-semibold"
          >
            Ver Calendário Completo
          </button>
        </div>

        {proximosMarcos.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">
            Nenhum marco acadêmico futuro cadastrado para este período.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {proximosMarcos.map(m => (
              <div
                key={m.marco_id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs"
              >
                <span className="font-mono text-[10px] text-slate-500 block">
                  Prazo: <strong className="text-slate-800">{m.data_prazo}</strong>
                </span>
                <div className="font-bold text-slate-900 leading-snug">{m.nome}</div>
                {m.observacao && (
                  <div className="text-[11px] text-slate-500 truncate">{m.observacao}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. ATALHOS COMPACTOS DAS TURMAS (Sem duplicar a tela administrativa de Turmas) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Atalhos Rápidos de Turmas
            </h3>
          </div>
          <button
            onClick={() => onNavigateToTab('turmas')}
            className="text-xs text-blue-600 hover:underline font-semibold"
          >
            Gestão Completa de Turmas
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {turmas.map(t => {
            const count = matriculas.filter(m => m.turma_id === t.turma_id && m.status === 'MATRICULADO').length;
            const hor = horariosTurma.find(h => h.turma_id === t.turma_id && h.ativo);
            const orig = turmasOrigem.filter(o => o.turma_id === t.turma_id && o.ativo);

            return (
              <div
                key={t.turma_id}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 flex flex-col justify-between gap-2.5 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">{t.nome}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                      {t.turno}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {count} estudante(s) · {hor ? `${hor.hora_inicio}–${hor.hora_fim}` : 'Horário a definir'}
                  </p>
                  {orig.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-mono text-slate-400 truncate">
                      <span>Docente Online:</span>
                      {orig.map(o => (
                        <span key={o.origem_id} className="bg-white px-1 border border-slate-200 rounded">
                          {o.codigo_externo}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                  <button
                    onClick={() => onIniciarSupervisao(t.turma_id)}
                    className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Modo Supervisão</span>
                  </button>
                  <button
                    onClick={() => onOpenTurma(t.turma_id)}
                    className="py-1.5 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Detalhes
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
