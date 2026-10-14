import React from "react";
import { useSupervisao } from "../context/SupervisaoContext";
import { chamarServidor } from "../services/escritaCoordenadaService";
import { carregarFilaSincronizacao } from "../services/indexedDbService";
export function DiagnosticoOperacional() {
  const { syncStatusState, perfilServidor } = useSupervisao();
  const [worker, setWorker] = React.useState<{
      verificado_em: string;
      coordenador_configurado: boolean;
      conta_servico_configurada: boolean;
    } | null>(null),
    [erro, setErro] = React.useState(""),
    [pendentes, setPendentes] = React.useState<number | null>(null),
    [ocupado, setOcupado] = React.useState(false);
  const ref = React.useRef(false);
  async function conferir() {
    if (ref.current) return;
    ref.current = true;
    setOcupado(true);
    setErro("");
    setWorker(null);
    try {
      setPendentes((await carregarFilaSincronizacao()).length);
      const r = await chamarServidor("/api/diagnostico");
      if (r.status !== 200 || !r.corpo.ok)
        throw new Error(
          r.corpo.message || "Worker indisponível ou acesso negado.",
        );
      setWorker(r.corpo);
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível verificar o serviço.",
      );
    } finally {
      ref.current = false;
      setOcupado(false);
    }
  }
  const data = (d: string | null | undefined) =>
    d && !Number.isNaN(Date.parse(d))
      ? new Date(d).toLocaleString("pt-BR")
      : "Não verificado";
  if (perfilServidor?.papel !== "PROFESSORA_ADMIN") return null;
  return (
    <section className="prisma-section space-y-3">
      <h2 className="prisma-title text-xl">Confiabilidade e recuperação</h2>
      <button
        disabled={ocupado}
        onClick={() => void conferir()}
        className="underline p-2"
      >
        {ocupado ? "Verificando…" : "Verificar Worker e fila"}
      </button>
      {erro && (
        <p role="alert" className="text-red-700">
          {erro}
        </p>
      )}
      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <dt className="font-semibold">Worker / autenticação</dt>
          <dd>
            {worker
              ? `Identidade verificada no servidor · ${data(worker.verificado_em)}`
              : "Não verificado nesta sessão"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Persistência coordenada</dt>
          <dd>
            {worker
              ? worker.coordenador_configurado
                ? "Binding configurado; acesso Google deve ser conferido separadamente"
                : "Binding indisponível"
              : "Não verificado"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Última leitura da planilha</dt>
          <dd>{data(syncStatusState.ultimaLeituraSucesso)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Última escrita confirmada</dt>
          <dd>{data(syncStatusState.ultimaEscritaSucesso)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Operações no dispositivo</dt>
          <dd>
            {pendentes == null
              ? "Clique em verificar"
              : `${pendentes} na fila; confira conflitos antes de encerrar`}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Drive / backup</dt>
          <dd>
            Verifique o painel de documentos e a conferência do arquivo de
            backup abaixo. Arquivo gerado não comprova restauração.
          </dd>
        </div>
      </dl>
      {syncStatusState.erros.length > 0 && (
        <ul className="list-disc pl-5 text-sm" aria-label="Falhas recentes">
          {syncStatusState.erros.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
