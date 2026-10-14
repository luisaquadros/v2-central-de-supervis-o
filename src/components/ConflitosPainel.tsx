import React, { useEffect, useState } from "react";
import {
  carregarFilaSincronizacao,
  type SyncQueueItem,
} from "../services/indexedDbService";
import {
  consultarConflito,
  adotarVersaoOficial,
} from "../services/conflitosService";
import { useSupervisao } from "../context/SupervisaoContext";

export function ConflitosPainel() {
  const { sincronizarAgora, perfilServidor } = useSupervisao();
  const [itens, setItens] = useState<SyncQueueItem[]>([]),
    [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const [revisao, setRevisao] = useState<Awaited<
    ReturnType<typeof consultarConflito>
  > | null>(null);
  useEffect(() => {
    if (perfilServidor?.papel !== "PROFESSORA_ADMIN") { setItens([]); setRevisao(null); return; }
    let ativo = true;
    void carregarFilaSincronizacao()
      .then((q) => {
        if (ativo) setItens(q.filter((i) => i.status === "CONFLITO"));
      })
      .catch(() => setErro("Não foi possível ler os conflitos."));
    return () => {
      ativo = false;
    };
  }, [perfilServidor?.papel]);
  const baixar = (item: SyncQueueItem) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(item, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "edicao-local-" + item.id + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const revisar = async (id: string) => {
    setOcupado(true);
    setErro("");
    try {
      setRevisao(await consultarConflito(id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao revisar.");
    } finally {
      setOcupado(false);
    }
  };
  const resolver = async () => {
    if (!revisao) return;
    setOcupado(true);
    try {
      await adotarVersaoOficial(revisao.item.id);
      setItens((q) => q.filter((i) => i.id !== revisao.item.id));
      setRevisao(null);
      await sincronizarAgora();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao resolver.");
    } finally {
      setOcupado(false);
    }
  };
  if (perfilServidor?.papel !== "PROFESSORA_ADMIN") return null;
  return (
    <section
      aria-label="Conflitos de sincronização"
      className="space-y-2 border rounded-lg p-3"
    >
      <h3 className="font-semibold">Conflitos: {itens.length}</h3>
      <p>
        A edição local será preservada em arquivo de recuperação. Nenhum dado
        será sobrescrito na planilha.
      </p>
      {erro && (
        <p role="alert" className="text-red-800">
          {erro}
        </p>
      )}
      {itens.map((i) => (
        <div key={i.id} className="flex flex-wrap gap-2">
          <span>{i.tabela}</span>
          <button
            disabled={ocupado}
            onClick={() => baixar(i)}
            className="underline"
          >
            Baixar edição local
          </button>
          <button
            disabled={ocupado}
            onClick={() => void revisar(i.id)}
            className="underline"
          >
            Revisar versão oficial
          </button>
        </div>
      ))}
      {revisao && (
        <div className="space-y-2">
          <p>
            Campos diferentes: {revisao.campos.join(", ") || "nenhum"}.{" "}
            {revisao.remoto
              ? "Registro oficial localizado."
              : "Registro não existe na planilha."}
          </p>
          <button
            disabled={ocupado}
            onClick={() => void resolver()}
            className="border rounded p-2"
          >
            Confirmar uso da versão oficial e arquivar minha edição
          </button>
          <button
            disabled={ocupado}
            onClick={() => setRevisao(null)}
            className="p-2"
          >
            Cancelar revisão
          </button>
        </div>
      )}
    </section>
  );
}
