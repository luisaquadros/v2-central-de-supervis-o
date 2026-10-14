import React from "react";
import { useSupervisao } from "../context/SupervisaoContext";
import { ModalWrapper } from "../components/Modals";
import { revisarEncerramento } from "../services/encerramentoPeriodoService";
import { carregarFilaSincronizacao } from "../services/indexedDbService";

export function SemestresView() {
  const c = useSupervisao();
  const [novo, setNovo] = React.useState(false),
    [nome, setNome] = React.useState(""),
    [inicio, setInicio] = React.useState(""),
    [fim, setFim] = React.useState(""),
    [aulas, setAulas] = React.useState(""),
    [modelo, setModelo] = React.useState(""),
    [statusNovo,setStatusNovo] = React.useState<"PLANEJADO"|"ATIVO">("PLANEJADO");
  const [erro, setErro] = React.useState(""),
    [ocupado, setOcupado] = React.useState(false),
    [revisar, setRevisar] = React.useState(""),
    [pendentes, setPendentes] = React.useState(0),
    [confirmado, setConfirmado] = React.useState(false);
  const busy = React.useRef(false);
  React.useEffect(() => {
    void carregarFilaSincronizacao().then((f) => setPendentes(f.length));
  }, [revisar, c.syncStatusState]);
  const periodo = c.periodos.find((p) => p.periodo_id === revisar);
  const revisao = periodo
    ? revisarEncerramento(periodo, {
        turmas: c.turmas,
        matriculas: c.matriculas,
        criterios: c.criterios,
        avaliacoes: c.avaliacoes,
        pendencias: c.getPendenciasOperacionais(),
        pendentesSync: pendentes,
      })
    : null;
  async function executar(fn: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setOcupado(true);
    setErro("");
    try {
      await fn();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      busy.current = false;
      setOcupado(false);
    }
  }
  return (
    <div className="prisma-shell-content space-y-6">
      <header className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="prisma-title text-3xl">Semestres</h1>
          <p className="prisma-meta">
            Estrutura reutilizável, matrículas e históricos independentes.
          </p>
        </div>
        <button
          className="cs-primary-action px-4 py-3"
          onClick={() => {
            setErro("");
            setNovo(true);
          }}
        >
          Novo semestre
        </button>
      </header>
      {c.roteirosPeriodo.filter(r=>r.estado==='PENDENTE').map(r=><section key={r.periodo_id} className="prisma-section space-y-2" aria-label={`Criação pendente de ${r.nome}`}>
        <h2 className="font-semibold">Criação pendente: {r.nome}</h2>
        <p className="prisma-meta">{r.passos.filter(p=>p.estado==='CONFIRMADO').length} de {r.passos.length} etapas confirmadas. Nenhum novo ID será gerado na retomada.</p>
        <button disabled={ocupado} className="underline p-2" onClick={()=>void executar(()=>c.retomarCriacaoPeriodo(r.periodo_id))}>Retomar criação</button>
      </section>)}
      <ul className="grid gap-4 md:grid-cols-2">
        {c.periodos.map((p) => (
          <li className="cs-panel p-5 space-y-3" key={p.periodo_id}>
            <h2 className="prisma-title text-xl">{p.nome}</h2>
            <p className="prisma-meta">
              {p.data_inicio} a {p.data_fim} · {p.status}
              <br />
              {
                c.turmas.filter((t) => t.periodo_id === p.periodo_id).length
              }{" "}
              turmas
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className="underline p-2"
                onClick={() => c.setSelectedPeriodoId(p.periodo_id)}
              >
                {p.periodo_id === c.selectedPeriodoId
                  ? "Período selecionado"
                  : "Consultar período"}
              </button>
              {p.status !== "ARQUIVADO" && (
                <button
                  className="underline p-2"
                  onClick={() => {
                    setConfirmado(false);
                    setErro("");
                    setRevisar(p.periodo_id);
                  }}
                >
                  Revisar encerramento
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {novo && (
        <ModalWrapper
          title="Novo semestre"
          onClose={() => setNovo(false)}
          busy={ocupado}
          error={erro}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void executar(async () => {
                const id = await c.createNovoPeriodo(
                  nome,
                  inicio,
                  fim,
                  modelo || undefined,
                  aulas || undefined,
                  statusNovo,
                );
                c.setSelectedPeriodoId(id);
                setNovo(false);
              });
            }}
            className="space-y-3"
          >
            <label className="block">
              Identificação
              <input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="2027.1"
                className="block border border-slate-200 p-3 w-full mt-1"
              />
            </label>
            <label className="block">
              Início do semestre
              <input
                required
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="block border border-slate-200 p-3 w-full mt-1"
              />
            </label>
            <label className="block">
              Término do semestre
              <input
                required
                type="date"
                min={inicio}
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                className="block border border-slate-200 p-3 w-full mt-1"
              />
            </label>
            <label className="block">
              Início das aulas (opcional)
              <input
                type="date"
                min={inicio}
                max={fim}
                value={aulas}
                onChange={(e) => setAulas(e.target.value)}
                className="block border border-slate-200 p-3 w-full mt-1"
              />
            </label>
            <label className="block">Status inicial
              <select value={statusNovo} onChange={e=>setStatusNovo(e.target.value as 'PLANEJADO'|'ATIVO')} className="block border border-slate-200 p-3 w-full mt-1">
                <option value="PLANEJADO">Planejado</option><option value="ATIVO">Ativo</option>
              </select>
            </label>
            <label className="block">
              Modelo anterior
              <select
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                className="block border border-slate-200 p-3 w-full mt-1"
              >
                <option value="">Sem modelo</option>
                {c.periodos.map((p) => (
                  <option key={p.periodo_id} value={p.periodo_id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <p className="prisma-meta">
              Turmas, critérios, configurações e rubricas recebem novos IDs.
              O cronograma herdado fica sem datas para conferência.
              Disciplinas continuam no catálogo compartilhado. Matrículas e
              registros acadêmicos permanecem no período anterior. Rubricas
              copiadas ficam em rascunho e exigem conferência.
            </p>
            <button
              type="submit"
              className="cs-primary-action px-4 py-3"
              disabled={ocupado}
            >
              {ocupado ? "Registrando…" : "Criar semestre planejado"}
            </button>
          </form>
        </ModalWrapper>
      )}
      {periodo && revisao && (
        <ModalWrapper
          title={`Encerramento — ${periodo.nome}`}
          onClose={() => setRevisar("")}
          busy={ocupado}
          error={erro}
        >
          <p>
            {revisao.matriculas} matrículas · {revisao.turmas} turmas
          </p>
          <h3 className="font-semibold">Pendências identificadas</h3>
          {revisao.pendencias.length ? (
            <ul className="list-disc pl-5 space-y-2">
              {revisao.pendencias.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma pendência identificada pelos controles disponíveis.</p>
          )}
          <h3 className="font-semibold">Conferência da professora</h3>
          <ul className="list-disc pl-5">
            {revisao.verificacoesManuais.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
          <p className="prisma-meta">
            Os fluxos estruturados de reposição, pareceres e homologação
            versionada ainda não são verificados automaticamente. O arquivamento
            bloqueia edições comuns; não exclui dados nem homologa notas.
          </p>
          <label className="flex gap-3 items-start">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />
            <span>
              Conferi os itens acima e confirmo o arquivamento deste período.
            </span>
          </label>
          <button
            disabled={ocupado || !confirmado || revisao.pendencias.length > 0}
            onClick={() =>
              void executar(async () => {
                await c.arquivarPeriodo(periodo.periodo_id, confirmado);
                setRevisar("");
              })
            }
            className="cs-primary-action p-3"
          >
            Confirmar e arquivar
          </button>
        </ModalWrapper>
      )}
    </div>
  );
}
