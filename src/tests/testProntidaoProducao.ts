import assert from "node:assert/strict";
import { indexedDB } from "fake-indexeddb";
import { criarAmbiente } from "./ajudaAmbiente";
import { criarContaServicoDeTeste } from "./ajudaContaServico";
import {
  compararVersaoDeCampos,
  idCritico,
  adaptarRegistroCritico,
} from "../server/coordenacaoCritica";
import { obterDatasCalendarioAcademico } from "../services/supervisaoOperacionalService";
import { limparCachePerfil } from "../services/escritaCoordenadaService";

const mem = new Map<string, string>();
Object.assign(globalThis, {
  window: { indexedDB },
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => mem.set(k, v),
    removeItem: (k: string) => mem.delete(k),
  },
});
const db = await import("../services/indexedDbService");
const sheets = await import("../services/googleSheetsService");
const sync = await import("../services/syncService");
const sa = await criarContaServicoDeTeste();
const abas = {
  frequencias: [["frequencia_id", "matricula_id", "data_aula", "status"]],
  matriculas: [
    ["matricula_id", "turma_id", "status"],
    ["m1", "t1", "MATRICULADO"],
    ["m2", "t2", "MATRICULADO"],
  ],
  turmas: [["turma_id"], ["t1"], ["t2"]],
  encontros_turma: [["encontro_id", "turma_id", "data", "chamada_salva"]],
  avaliacoes: [
    ["avaliacao_id", "nota"],
    ["av1", "1,8"],
  ],
  configuracoes: [["chave", "valor"]],
};
const amb = await criarAmbiente({
  abas,
  env: {
    GOOGLE_SERVICE_ACCOUNT_JSON: sa.json,
    ACESSOS_JSON: JSON.stringify({
      monitoras: [
        {
          email: "monitora@exemplo.com",
          turmas: ["t1"],
          operacoes: ["CHAMADA"],
        },
      ],
    }),
  },
});
const send = async (p: unknown, email = "professora@exemplo.com") =>
  fetch("/api/critical-write", {
    method: "POST",
    headers: {
      Authorization: "Bearer sintetico",
      "X-Firebase-Id-Token": await amb.emissor.token(email),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(p),
  });
try {
  const freq = {
    frequencia_id: "f1",
    matricula_id: "m2",
    turma_id: "t1",
    data_aula: "2026-10-13",
    status: "PRESENTE",
  };
  assert.equal(
    (
      await send(
        {
          tabela: "frequencias",
          tipo: "INSERT",
          registro: freq,
          esperado: null,
          operacaoId: "scope-test-123",
        },
        "monitora@exemplo.com",
      )
    ).status,
    403,
  );
  assert.equal(
    abas.frequencias.length,
    1,
    "nenhuma matrícula alheia pode ser inserida",
  );
  assert.equal(
    (
      await send({
        tabela: "avaliacoes",
        tipo: "INSERT",
        registro: { nota: -2 },
        esperado: null,
        operacaoId: "schema-test-123",
      })
    ).status,
    400,
  );
  assert.equal(abas.avaliacoes.length, 2);
  assert.deepEqual(
    compararVersaoDeCampos(
      "avaliacoes",
      { avaliacao_id: "av1", nota: 2 },
      { avaliacao_id: "av1", nota: 1.8 },
      { avaliacao_id: "av1", nota: "1,8" },
      ["avaliacao_id", "nota"],
      "UPDATE",
    ),
    [],
  );
  assert.equal(
    idCritico("frequencias", { matricula_id: "m1", data_aula: "13/10/2026" }),
    idCritico("frequencias", { matricula_id: "m1", data_aula: "2026-10-13" }),
  );
  assert.equal(
    adaptarRegistroCritico("frequencias", {
      status: "PRESENTE",
      status_original: "ATRASO",
      atraso: false,
    }).status,
    "PRESENTE",
  );

  const fechar = {
    tabela: "encontros_turma",
    tipo: "INSERT",
    registro: {
      encontro_id: "e1",
      turma_id: "t1",
      data: "2026-10-13",
      chamada_salva: true,
    },
    esperado: null,
    operacaoId: "attendance-close-123",
  };
  assert.equal((await send(fechar)).status, 409);
  // Resposta perdida após aplicação remota: reenvio confirma o resultado, sem nova gravação.
  const originalFetch = globalThis.fetch;
  let lose = true;
  globalThis.fetch = async (input: any, init?: RequestInit) => {
    const r = await originalFetch(input, init);
    if (
      lose &&
      String(input).includes("sheets.googleapis.com") &&
      String(input).includes("/values:batchUpdate")
    ) {
      lose = false;
      throw new TypeError("falha de rede sintética após escrita");
    }
    return r;
  };
  const payload = {
    tabela: "avaliacoes",
    tipo: "UPDATE",
    registro: { avaliacao_id: "av1", nota: 2 },
    esperado: { avaliacao_id: "av1", nota: 1.8 },
    operacaoId: "lost-response-123",
  };
  assert.equal((await send(payload)).status, 502);
  assert.equal(abas.avaliacoes[1][1], 2);
  assert.equal((await send(payload)).status, 200);
  assert.equal(
    amb.chamadas.filter(
      (c) => c.metodo === "POST" && c.url.includes("/values:batchUpdate"),
    ).length,
    1,
  );
  assert.equal(
    (await send({ ...payload, registro: { avaliacao_id: "av1", nota: 9 } }))
      .status,
    409,
    "um recibo não aceita outro conteúdo",
  );
  globalThis.fetch = originalFetch;

  // Permissão negada: nenhuma tentativa de leitura direta do Sheets.
  amb.entrar("negada@exemplo.com");
  limparCachePerfil();
  sheets.setMockToken("sintetico");
  const before = amb.chamadas.length;
  assert.equal((await sync.sincronizarDaBaseOficial()).sucesso, false);
  assert.equal(amb.chamadas.length, before);
  amb.entrar();
  limparCachePerfil();

  // Primeira frequência captura base nula, sem sobrescrever cache antes da operação.
  sheets.clearAccessToken();
  const first = await sync.salvarRegistroResiliente("frequencias", "INSERT", {
    frequencia_id: "f-new",
    matricula_id: "m1",
    data_aula: "2026-10-13",
    status: "PRESENTE",
  });
  assert.equal(first.queueItem?.versao_base, null);
  sheets.setMockToken("sintetico");
  await sync.processarFilaSincronizacao();
  assert.equal(abas.frequencias.length, 2);
  assert.equal((await send(fechar)).status, 200);
  assert.equal((await db.carregarFilaSincronizacao()).length, 0);

  // Cancelar criação ainda não enviada não exige excluir um registro remoto inexistente.
  sheets.clearAccessToken();
  await db.salvarAlteracaoAtomica("documentos", "INSERT", {
    documento_id: "d1",
  });
  const canceled = await db.salvarAlteracaoAtomica("documentos", "DELETE", {
    documento_id: "d1",
  });
  assert.equal(canceled.cancelada, true);
  assert.equal((await db.carregarFilaSincronizacao()).length, 0);

  // Edição após erro mantém a operação original intacta para recuperar seu recibo.
  const pending = await db.salvarAlteracaoAtomica("configuracoes", "INSERT", {
    chave: "APP_TEST",
    valor: "primeira",
  });
  await db.atualizarItemFila(pending.id, { status: "ERRO", tentativas: 1 });
  await db.salvarAlteracaoAtomica("configuracoes", "UPDATE", {
    chave: "APP_TEST",
    valor: "segunda",
  });
  const queue = await db.carregarFilaSincronizacao();
  assert.equal(queue.length, 2);
  assert.equal(queue[0].id, pending.id);
  assert.equal(queue[0].payload.valor, "primeira");
  for (const q of queue) await db.removerItemFilaConfirmado(q.id);

  // Conta anterior: preservar arquivo de recuperação, retirar dados da cópia visível.
  await db.garantirCacheDoUsuario("uid-A");
  mem.set("cs_avaliacoes_completas_v1", '[{"avaliacao_id":"av-local"}]');
  assert.equal(await db.garantirCacheDoUsuario("uid-B"), "LIMPO");
  assert.equal(mem.get("cs_avaliacoes_completas_v1"), undefined);
  assert(mem.has("cs_arquivo_conta:uid-A:cs_avaliacoes_completas_v1"));

  // Resolução de conflito conserva edição original e não grava sobre a planilha.
  const conflito = await db.salvarAlteracaoAtomica("avaliacoes", "INSERT", {
    avaliacao_id: "av-conflito",
    nota: 3,
  });
  await db.atualizarItemFila(conflito.id, { status: "CONFLITO" });
  await db.resolverItemConflito(conflito, {
    avaliacao_id: "av-conflito",
    nota: 4,
  });
  assert.equal(
    (await db.carregarTodasTabelasDoIndexedDb())?.avaliacoes[0].nota,
    4,
  );
  assert.equal((await db.carregarFilaSincronizacao()).length, 0);
  assert(
    obterDatasCalendarioAcademico(
      {
        periodo_id: "p2027",
        nome: "2027.1",
        data_inicio: "2027-02-01",
        data_fim: "2027-06-30",
        status: "ATIVO",
      },
      "2027-03-01",
    ).estaNaSemanaFinal === false,
  );
  const usuarioAnterior=sheets.auth.currentUser;
  try {
    (sheets.auth as any).currentUser={uid:'uid-token-A'};
    sheets.setMockToken('oauth-sintetico-A');
    assert.equal(await sheets.getAccessToken(),'oauth-sintetico-A');
    (sheets.auth as any).currentUser={uid:'uid-token-B'};
    assert.equal(await sheets.getAccessToken(),null,'token OAuth nunca acompanha outra identidade Firebase');
  } finally {(sheets.auth as any).currentUser=usuarioAnterior;}
  console.log(
    "Produção: escopo, leitura negada, schema, formatos, recuperação, fila, cache e conflitos validados sem dados reais.",
  );
} finally {
  amb.restaurar();
  sheets.clearAccessToken();
  limparCachePerfil();
}
