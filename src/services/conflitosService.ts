import {
  carregarFilaSincronizacao,
  resolverItemConflito,
  garantirCacheDoUsuario,
  type SyncQueueItem,
} from "./indexedDbService";
import { carregarDadosDaPlanilhaOficial, auth } from "./googleSheetsService";
import { obterPerfilServidor } from "./escritaCoordenadaService";
import { carregarViaServidor } from "./leituraServidor";
import { recordIdentity } from "./recordIdentity";

export async function consultarConflito(
  id: string,
): Promise<{
  item: SyncQueueItem;
  remoto: Record<string, unknown> | null;
  campos: string[];
}> {
  const perfil = await obterPerfilServidor();
  if (!perfil)
    throw new Error(
      "Conecte uma conta autorizada antes de revisar o conflito.",
    );
  if (
    auth.currentUser &&
    (await garantirCacheDoUsuario(auth.currentUser.uid)) ===
      "PENDENTES_DE_OUTRA_CONTA"
  )
    throw new Error("Este conflito pertence a outra conta.");
  const item = (await carregarFilaSincronizacao()).find(
    (i) => i.id === id && i.status === "CONFLITO",
  );
  if (!item) throw new Error("Conflito não encontrado.");
  const dados =
    perfil.papel === "MONITORA"
      ? await carregarViaServidor(perfil)
      : await carregarDadosDaPlanilhaOficial();
  const rows = dados._rawMap[item.tabela];
  if (!Array.isArray(rows))
    throw new Error(
      "Não foi possível ler a versão oficial. Nenhuma alteração foi descartada.",
    );
  const matches = rows.filter((r) => {
    try {
      return (
        recordIdentity(item.tabela, r) ===
        recordIdentity(item.tabela, item.payload)
      );
    } catch {
      return false;
    }
  });
  if (matches.length > 1)
    throw new Error(
      "Chaves duplicadas na planilha. Revisão manual necessária.",
    );
  const remoto = matches[0] ?? null;
  const campos = Object.keys(item.payload).filter(
    (k) => JSON.stringify(item.payload[k]) !== JSON.stringify(remoto?.[k]),
  );
  return { item, remoto, campos };
}
/** Somente adota a versão oficial; a edição local é arquivada, sem reaplicar dados automaticamente. */
export async function adotarVersaoOficial(id: string): Promise<void> {
  const { item, remoto } = await consultarConflito(id);
  await resolverItemConflito(item, remoto);
}
