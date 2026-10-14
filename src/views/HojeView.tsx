import React from "react";
import { Play, Calendar, ArrowRight, BookOpen } from "lucide-react";
import { useSupervisao } from "../context/SupervisaoContext";
import {
  listarProximasSupervisoes,
  getHojeDataIso,
} from "../services/supervisaoOperacionalService";
import { NavTab } from "../types";

interface HojeViewProps {
  onOpenTurma: (id: string) => void;
  onIniciarSupervisao: (id: string) => void;
  onNavigateToTab: (tab: NavTab, param?: string) => void;
  onOpenPrepararAula?: (id: string) => void;
  onOpenAluno?: (id: string, tab?: string) => void;
}
export function HojeView({
  onOpenTurma,
  onIniciarSupervisao,
  onNavigateToTab,
  onOpenPrepararAula,
  onOpenAluno,
}: HojeViewProps) {
  const {
    turmas,
    horariosTurma,
    encontrosTurma,
    selectedPeriodoId,
    periodos,
    getSupervisaoAtual,
    getPendenciasOperacionais,
    perfilServidor,
  } = useSupervisao();
  const [agora, setAgora] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const monitora = perfilServidor?.papel === "MONITORA";
  const ativas = turmas.filter(
    (t) => t.periodo_id === selectedPeriodoId && t.status !== "ARQUIVADO",
  );
  const agenda = listarProximasSupervisoes(
    ativas,
    horariosTurma,
    encontrosTurma,
    agora,
  );
  const atual = getSupervisaoAtual();
  const destaque =
    atual.emAndamento && atual.turma?.periodo_id === selectedPeriodoId
      ? atual.turma
      : agenda[0]?.turma;
  const pendencias = getPendenciasOperacionais().filter(
    (p) =>
      ativas.some((t) => t.turma_id === p.turma_id) &&
      (!p.prazo || p.prazo.slice(0, 10) <= getHojeDataIso(agora)) &&
      (!monitora || p.tipo === "DOCUMENTO"),
  );
  const [limite, setLimite] = React.useState(8);
  function abrir(p: (typeof pendencias)[number]) {
    if (p.matricula_id && onOpenAluno) {
      const tab =
        p.tipo === "DOCUMENTO"
          ? "documentos"
          : p.tipo === "ORIENTACAO"
            ? "orientacoes"
            : ["FALTA_INJUSTIFICADA", "JUSTIFICATIVA"].includes(p.tipo)
              ? "frequencia"
              : p.tipo.includes("RSS") || p.tipo === "REGISTRO_SEMANAL"
                ? "registros"
                : "resumo";
      onOpenAluno(p.matricula_id, tab);
    } else if (
      p.tipo === "CHAMADA" &&
      p.turma_id &&
      p.prazo?.slice(0, 10) === getHojeDataIso(agora) &&
      !monitora
    )
      onIniciarSupervisao(p.turma_id);
    else if (p.turma_id) onOpenTurma(p.turma_id);
    else onNavigateToTab(p.targetTab, p.targetParam);
  }
  return (
    <div className="prisma-shell-content space-y-6">
      <header>
        <p className="prisma-meta">
          {agora.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}{" "}
          ·{" "}
          {periodos.find((p) => p.periodo_id === selectedPeriodoId)?.nome ||
            "Selecione um período"}
        </p>
        <h1 className="prisma-title text-3xl mt-2">
          {monitora ? "Acompanhamento autorizado" : "Hoje"}
        </h1>
        <p className="prisma-meta mt-2">
          {monitora
            ? "Documentação administrativa das suas turmas."
            : "Prepare o próximo encontro e retome o que precisa de atenção."}
        </p>
      </header>
      <section
        className="cs-panel p-5 sm:p-6 space-y-4"
        aria-labelledby="proximo-encontro"
      >
        <div className="flex gap-2 items-center prisma-meta">
          <Calendar aria-hidden className="w-5 h-5" />
          <span>Próxima supervisão</span>
        </div>
        <h2 id="proximo-encontro" className="prisma-title text-2xl">
          {destaque?.nome || "Nenhum encontro agendado"}
        </h2>
        {destaque && (
          <>
            <p className="prisma-meta">
              {agenda[0]?.dataProxima
                ? new Date(
                    `${agenda[0].dataProxima}T12:00:00`,
                  ).toLocaleDateString("pt-BR")
                : "Consulte a agenda"}
              {agenda[0]?.horario
                ? ` · ${agenda[0].horario.hora_inicio}–${agenda[0].horario.hora_fim}`
                : ""}
            </p>
            <div className="flex flex-wrap gap-3">
              {!monitora && (
                <>
                  <button
                    onClick={() => onIniciarSupervisao(destaque.turma_id)}
                    className="cs-primary-action px-4 py-3 inline-flex items-center gap-2"
                  >
                    <Play aria-hidden className="w-4 h-4" />
                    Iniciar modo aula
                  </button>
                  {onOpenPrepararAula && (
                    <button
                      onClick={() => onOpenPrepararAula(destaque.turma_id)}
                      className="border border-slate-200 rounded-xl px-4 py-3 inline-flex gap-2 items-center"
                    >
                      <BookOpen aria-hidden className="w-4 h-4" />
                      Preparar aula
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => onOpenTurma(destaque.turma_id)}
                className="underline px-2 py-3"
              >
                Abrir turma
              </button>
            </div>
          </>
        )}
        {!destaque && (
          <button
            onClick={() => onNavigateToTab("calendario")}
            className="underline text-sm"
          >
            Consultar agenda
          </button>
        )}
      </section>
      <section aria-labelledby="prioridades-hoje" className="space-y-3">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 id="prioridades-hoje" className="prisma-title text-xl">
            Pendências acionáveis
          </h2>
          <button
            className="underline text-sm"
            onClick={() => onNavigateToTab("pendencias")}
          >
            Ver todas
          </button>
        </div>
        <p className="prisma-meta">
          Faltas e reposições, documentação e orientações com registro
          existente. Itens com prazo futuro ficam na agenda.
        </p>
        {!pendencias.length && (
          <p className="prisma-empty">
            Nenhuma pendência disponível para estes filtros. A ausência de
            registros não confirma uma conferência.
          </p>
        )}
        <ul className="space-y-2">
          {pendencias.slice(0, limite).map((p) => (
            <li key={p.id}>
              <button
                onClick={() => abrir(p)}
                className="cs-panel w-full p-4 text-left flex justify-between gap-3 items-center"
              >
                <div className="min-w-0">
                  <span className="prisma-meta block">
                    {p.turma_nome} {p.aluno_nome ? `· ${p.aluno_nome}` : ""}
                  </span>
                  <span className="font-semibold text-sm block break-words">
                    {p.titulo}
                  </span>
                  <span className="prisma-meta block break-words">
                    {p.descricao}
                  </span>
                </div>
                <ArrowRight aria-hidden className="w-4 h-4 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
        {pendencias.length > limite && (
          <button
            className="underline p-3"
            onClick={() => setLimite((n) => n + 8)}
          >
            Mostrar mais pendências
          </button>
        )}
      </section>
      <details className="prisma-section">
        <summary>Pareceres de monitoras</summary>
        <p className="prisma-meta">
          O fluxo estruturado de pareceres ainda não está disponível. Consulte
          somente os registros administrativos autorizados na turma.
        </p>
      </details>
      <section className="space-y-3">
        <h2 className="prisma-title text-xl">Turmas neste período</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {ativas.map((t) => (
            <li key={t.turma_id}>
              <button
                onClick={() => onOpenTurma(t.turma_id)}
                className="cs-panel w-full p-4 flex items-center justify-between text-left"
              >
                <span className="font-semibold text-sm">{t.nome}</span>
                <ArrowRight aria-hidden className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
