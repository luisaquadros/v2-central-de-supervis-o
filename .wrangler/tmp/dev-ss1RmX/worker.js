var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/server/utilitariosWorker.ts
var LIMITE_CORPO = 131072;
async function lerCorpoLimitado(request, limite) {
  if (!request.body) return "";
  const leitor = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0, texto = "";
  for (; ; ) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      await leitor.cancel().catch(() => {
      });
      return null;
    }
    texto += decoder.decode(value, { stream: true });
  }
  return texto + decoder.decode();
}
__name(lerCorpoLimitado, "lerCorpoLimitado");
var BASE_SHEETS_PADRAO = "https://sheets.googleapis.com/v4/spreadsheets/";
function baseSheets(env) {
  const o = env.SHEETS_API_BASE;
  return o && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(o) ? o.replace(/\/?$/, "/") : BASE_SHEETS_PADRAO;
}
__name(baseSheets, "baseSheets");

// src/server/autorizacao.ts
var PROJETO_FIREBASE_PADRAO = "gen-lang-client-0003708748";
var URL_JWKS_PADRAO = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
var loopback = /* @__PURE__ */ __name((u) => /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u), "loopback");
function urlJwks(env) {
  return env.JWKS_URL && loopback(env.JWKS_URL) ? env.JWKS_URL : URL_JWKS_PADRAO;
}
__name(urlJwks, "urlJwks");
function listaDeAdministradores(env) {
  return (env.ADMIN_EMAILS ?? "").split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+$/.test(e));
}
__name(listaDeAdministradores, "listaDeAdministradores");
var b64url = /* @__PURE__ */ __name((s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0)), "b64url");
var json = /* @__PURE__ */ __name((s) => JSON.parse(new TextDecoder().decode(b64url(s))), "json");
var cacheJwks = null;
var INTERVALO_MIN_REBUSCA_MS = 60 * 1e3;
async function obterChaves(url, agora, buscar, kid) {
  const valido = cacheJwks && cacheJwks.url === url && cacheJwks.ate > agora;
  if (valido && (cacheJwks.chaves.some((k) => k.kid === kid) || agora - cacheJwks.buscadoEm < INTERVALO_MIN_REBUSCA_MS)) return cacheJwks.chaves;
  const r = await buscar(url, { signal: AbortSignal.timeout(1e4) });
  if (!r.ok) throw new Error("JWKS indispon\xEDvel");
  const chaves = (await r.json()).keys;
  cacheJwks = { url, ate: agora + 60 * 60 * 1e3, buscadoEm: agora, chaves };
  return chaves;
}
__name(obterChaves, "obterChaves");
async function verificarIdTokenFirebase(token, env, agoraMs = Date.now(), buscar = fetch) {
  const partes = token.split(".");
  if (partes.length !== 3) throw new Error("formato");
  let cab, claims;
  try {
    cab = json(partes[0]);
    claims = json(partes[1]);
  } catch {
    throw new Error("formato");
  }
  if (cab.alg !== "RS256" || !cab.kid) throw new Error("algoritmo");
  const projeto = env.FIREBASE_PROJECT_ID || PROJETO_FIREBASE_PADRAO;
  const agora = Math.floor(agoraMs / 1e3);
  if (claims.aud !== projeto || claims.iss !== `https://securetoken.google.com/${projeto}`) throw new Error("emissor");
  if (typeof claims.exp !== "number" || claims.exp <= agora) throw new Error("expirado");
  if (typeof claims.iat !== "number" || claims.iat > agora + 300) throw new Error("emitido no futuro");
  if (!claims.sub || typeof claims.sub !== "string") throw new Error("sem sub");
  const chaves = await obterChaves(urlJwks(env), agoraMs, buscar, cab.kid);
  const jwk = chaves.find((k) => k.kid === cab.kid);
  if (!jwk) throw new Error("chave desconhecida");
  const chave = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valido = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", chave, b64url(partes[2]), new TextEncoder().encode(partes[0] + "." + partes[1]));
  if (!valido) throw new Error("assinatura");
  if (claims.email_verified !== true || typeof claims.email !== "string") throw new Error("e-mail n\xE3o verificado");
  return { email: claims.email.toLowerCase(), uid: claims.sub };
}
__name(verificarIdTokenFirebase, "verificarIdTokenFirebase");
async function autorizarAdministrador(idToken, env, agoraMs = Date.now(), buscar = fetch) {
  const admins = listaDeAdministradores(env);
  if (!admins.length) return {
    ok: false,
    status: 503,
    code: "ACESSO_NAO_CONFIGURADO",
    message: "Acesso de grava\xE7\xE3o n\xE3o configurado: defina ADMIN_EMAILS no Worker. Enquanto isso nenhuma grava\xE7\xE3o \xE9 aceita."
  };
  if (!idToken) return { ok: false, status: 401, code: "TOKEN_AUSENTE", message: "Identidade n\xE3o informada. Entre novamente com a conta Google." };
  let id;
  try {
    id = await verificarIdTokenFirebase(idToken, env, agoraMs, buscar);
  } catch {
    return { ok: false, status: 401, code: "TOKEN_INVALIDO", message: "Identidade inv\xE1lida ou expirada. Entre novamente com a conta Google." };
  }
  if (!admins.includes(id.email)) return { ok: false, status: 403, code: "NAO_AUTORIZADO", message: "Esta conta n\xE3o tem permiss\xE3o de grava\xE7\xE3o." };
  return { ok: true, email: id.email };
}
__name(autorizarAdministrador, "autorizarAdministrador");

// src/services/recordIdentity.ts
var PRIMARY_KEYS = {
  periodos: "periodo_id",
  disciplinas: "disciplina_id",
  turmas: "turma_id",
  horarios_turma: "horario_id",
  turmas_origem: "origem_id",
  alunos: "aluno_id",
  matriculas: "matricula_id",
  orientacoes: "orientacao_id",
  registros_semanais: "registro_id",
  documentos: "documento_id",
  avaliacoes: "avaliacao_id",
  feedback_alunos: "feedback_id",
  criterios_avaliacao: "criterio_id",
  ocorrencias: "ocorrencia_id",
  configuracoes: "chave",
  frequencias: "frequencia_id",
  pontos_acompanhamento: "ponto_id",
  marcos_academicos: "marco_id",
  entregas: "entrega_id",
  feedbacks: "feedback_id",
  registros_supervisao: "registro_id",
  grupos_pratica: "grupo_id",
  grupo_integrantes: "grupo_integrante_id",
  leituras_responsaveis: "leitura_agenda_id",
  encontros_turma: "encontro_id",
  preparacoes_aula: "preparacao_id",
  avaliacoes_completas: "avaliacao_id"
};

// src/server/coordenacaoCritica.ts
var TABELAS_CRITICAS = /* @__PURE__ */ new Set([
  "frequencias",
  "encontros_turma",
  "avaliacoes",
  "avaliacoes_completas",
  "documentos",
  "entregas",
  "leituras_responsaveis",
  // E1: registros de acompanhamento editáveis de dois aparelhos; antes iam direto, sem comparação de versão.
  "ocorrencias",
  "orientacoes",
  "feedback_alunos",
  "feedbacks",
  "pontos_acompanhamento",
  "registros_supervisao",
  "preparacoes_aula"
]);
function dataCanonica(texto) {
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{5}$/.test(texto)) return new Date(Date.UTC(1899, 11, 30) + Number(texto) * 864e5).toISOString().slice(0, 10);
  return texto;
}
__name(dataCanonica, "dataCanonica");
function valorComparavel(valor) {
  if (valor == null) return "";
  if (typeof valor === "boolean") return valor ? "TRUE" : "FALSE";
  if (typeof valor === "object") return JSON.stringify(valor);
  return dataCanonica(String(valor).trim());
}
__name(valorComparavel, "valorComparavel");
function adaptarRegistroCritico(tabela, registro) {
  const result = { ...registro };
  if (tabela === "frequencias" && result.status === "PRESENTE" && (result.atraso === true || result.status_original === "ATRASO")) result.status = "ATRASO";
  if (tabela === "leituras_responsaveis") {
    result.leitura_agenda_id = result.leitura_agenda_id ?? result.leitura_id;
    if (Array.isArray(result.responsaveis_efetivos)) result.responsaveis_efetivos = JSON.stringify(result.responsaveis_efetivos);
  }
  if (tabela === "avaliacoes_completas" && result.notas_criterios !== void 0)
    result.notas_criterios_json = JSON.stringify(result.notas_criterios);
  if (tabela === "registros_supervisao") {
    result.data = result.data ?? result.data_hora;
    result.descricao = result.descricao ?? result.texto;
  }
  if (tabela === "entregas") {
    result.tipo_entrega = result.tipo_entrega ?? result.tipo_documento;
    result.status = result.status ?? result.status_entrega;
    result.data_envio = result.data_envio ?? result.data_entrega;
  }
  return result;
}
__name(adaptarRegistroCritico, "adaptarRegistroCritico");
function idCritico(tabela, registro) {
  if (tabela === "frequencias" && registro.matricula_id && registro.data_aula)
    return JSON.stringify([String(registro.matricula_id), String(registro.data_aula)]);
  const key = PRIMARY_KEYS[tabela];
  const value = key && (registro[key] ?? (tabela === "leituras_responsaveis" ? registro.leitura_id : void 0));
  if (!key || value == null || !String(value).trim()) throw new Error("Identificador do registro inv\xE1lido");
  return String(value).trim();
}
__name(idCritico, "idCritico");
function compararVersaoDeCampos(tabela, registro, esperado, remoto, cabecalhos, tipo) {
  if (tipo === "INSERT") return remoto ? ["registro j\xE1 existe"] : [];
  if (!remoto) return ["registro n\xE3o encontrado"];
  if (!esperado) return ["vers\xE3o original indispon\xEDvel"];
  const editado = adaptarRegistroCritico(tabela, registro);
  const base = adaptarRegistroCritico(tabela, esperado);
  const permitido = new Set(cabecalhos);
  const chaves = (tipo === "DELETE" ? cabecalhos : Object.keys(editado)).filter((k) => permitido.has(k));
  const divergencias = [];
  for (const key of chaves) {
    const original = valorComparavel(base[key]);
    const atual = valorComparavel(remoto[key]);
    if (original !== atual) divergencias.push(key);
  }
  return divergencias;
}
__name(compararVersaoDeCampos, "compararVersaoDeCampos");
var CAMPO_TEXTO_LIVRE = /(observa|justific|descri|texto|narrativ|relato|comentari|conteudo|resumo|mensagem|duvida|limita|prioridade|proximo_passo|anotac|nota_texto|feedback|devolutiva|pauta|diario)/i;
var LIMITE_VALOR_LOG = 80;
var CAMPOS_TECNICOS = /* @__PURE__ */ new Set(["atualizado_em", "criado_em", "sincronizado_em"]);
var valorSeguro = /* @__PURE__ */ __name((campo, valor) => CAMPO_TEXTO_LIVRE.test(campo) ? "(texto)" : valorComparavel(valor).slice(0, LIMITE_VALOR_LOG), "valorSeguro");
function resumirAlteracaoParaLog(tabela, tipo, registro, remotoAntes, cabecalhos) {
  const novo = adaptarRegistroCritico(tabela, registro);
  const permitido = new Set(cabecalhos);
  const candidatos = (tipo === "DELETE" ? cabecalhos : Object.keys(novo)).filter((k) => permitido.has(k) && !CAMPOS_TECNICOS.has(k));
  const campos = [], antes = {}, depois = {};
  for (const k of candidatos) {
    const a = remotoAntes ? valorComparavel(remotoAntes[k]) : "";
    const d = tipo === "DELETE" ? "" : valorComparavel(novo[k]);
    if (tipo === "UPDATE" && a === d) continue;
    if (tipo !== "INSERT" && a !== "") antes[k] = valorSeguro(k, remotoAntes?.[k]);
    if (tipo !== "DELETE" && d !== "") depois[k] = valorSeguro(k, novo[k]);
    campos.push(k);
  }
  return { registro_id: idCritico(tabela, registro), campos, antes, depois };
}
__name(resumirAlteracaoParaLog, "resumirAlteracaoParaLog");
var COLUNAS_LOG_ALTERACOES = [
  "log_id",
  "ocorrido_em",
  "usuario_verificado",
  "tabela",
  "registro_id",
  "acao",
  "campos",
  "antes",
  "depois",
  "origem"
];
function linhaDeLog(operacaoId, agora, usuario, tabela, tipo, a) {
  return [
    operacaoId,
    agora,
    usuario.slice(0, 120),
    tabela,
    a.registro_id,
    tipo,
    a.campos.join(", "),
    JSON.stringify(a.antes),
    JSON.stringify(a.depois),
    "CENTRAL_WORKER"
  ];
}
__name(linhaDeLog, "linhaDeLog");

// src/server/worker.ts
var SPREADSHEET_ID = "1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4";
var json2 = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
}), "json");
var fail = /* @__PURE__ */ __name((message, status, code = "WRITE_FAILED") => json2({ ok: false, code, message }, status), "fail");
var colName = /* @__PURE__ */ __name((index) => {
  let i = index + 1, out = "";
  while (i > 0) {
    i--;
    out = String.fromCharCode(65 + i % 26) + out;
    i = Math.floor(i / 26);
  }
  return out;
}, "colName");
var quoted = /* @__PURE__ */ __name((name) => "'" + name.replaceAll("'", "''") + "'", "quoted");
async function googleFetch(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: "Bearer " + token, ...init.body ? { "Content-Type": "application/json" } : {} },
    signal: AbortSignal.timeout(2e4)
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw Object.assign(new Error("A conta Google n\xE3o autorizou a opera\xE7\xE3o."), { http: response.status });
    throw Object.assign(new Error("Erro da API Google Sheets (" + response.status + ")."), { http: 502 });
  }
  return response.json();
}
__name(googleFetch, "googleFetch");
var ABA_LOG = "log_alteracoes";
async function anexarLog(base, token, linha) {
  const URL_BASE = base + SPREADSHEET_ID;
  const meta = await googleFetch(URL_BASE + "?fields=" + encodeURIComponent("sheets(properties(title))"), token);
  const existe = (meta.sheets || []).some((x) => x.properties.title === ABA_LOG);
  if (!existe) {
    await googleFetch(URL_BASE + ":batchUpdate", token, { method: "POST", body: JSON.stringify({ requests: [
      { addSheet: { properties: { title: ABA_LOG, gridProperties: { rowCount: 1e3, columnCount: COLUNAS_LOG_ALTERACOES.length } } } }
    ] }) });
    await googleFetch(
      URL_BASE + "/values/" + encodeURIComponent(quoted(ABA_LOG) + "!A1") + "?valueInputOption=RAW",
      token,
      { method: "PUT", body: JSON.stringify({ values: [[...COLUNAS_LOG_ALTERACOES]] }) }
    );
  }
  await googleFetch(
    URL_BASE + "/values/" + encodeURIComponent(quoted(ABA_LOG) + "!A1") + ":append?valueInputOption=RAW",
    token,
    { method: "POST", body: JSON.stringify({ values: [linha] }) }
  );
}
__name(anexarLog, "anexarLog");
var WriteCoordinator = class {
  constructor(state, env) {
    this.state = state;
    this.tail = Promise.resolve();
    this.base = baseSheets(env ?? {});
  }
  static {
    __name(this, "WriteCoordinator");
  }
  async fetch(request) {
    const task = /* @__PURE__ */ __name(() => this.perform(request), "task");
    const response = this.tail.then(task, task);
    this.tail = response.then(() => void 0, () => void 0);
    return response;
  }
  async guardarLogPendente(linha) {
    const atuais = await this.state.storage.get("logs-pendentes") || [];
    await this.state.storage.put("logs-pendentes", [...atuais, linha].slice(-500));
  }
  async reenviarLogsPendentes(token) {
    const pendentes = await this.state.storage.get("logs-pendentes") || [];
    if (!pendentes.length) return;
    const restantes = [];
    for (const linha of pendentes) {
      try {
        if (!restantes.length) await anexarLog(this.base, token, linha);
        else restantes.push(linha);
      } catch {
        restantes.push(linha);
      }
    }
    await this.state.storage.put("logs-pendentes", restantes);
  }
  async perform(request) {
    try {
      const bearer = request.headers.get("Authorization") || "";
      if (!/^Bearer \S+$/.test(bearer)) return fail("Autentica\xE7\xE3o Google necess\xE1ria.", 401);
      const token = bearer.slice(7);
      const usuarioVerificado = request.headers.get("X-Usuario-Verificado") || "";
      if (!usuarioVerificado) return fail("Identidade verificada ausente.", 401, "TOKEN_AUSENTE");
      const payload = await request.json();
      if (!payload || !TABELAS_CRITICAS.has(payload.tabela) || !["INSERT", "UPDATE", "DELETE"].includes(payload.tipo) || !payload.operacaoId || !/^[-a-zA-Z0-9_:]{8,100}$/.test(payload.operacaoId) || !payload.registro || typeof payload.registro !== "object")
        return fail("Opera\xE7\xE3o cr\xEDtica inv\xE1lida.", 400);
      await this.reenviarLogsPendentes(token);
      const receipt = "op:" + payload.operacaoId;
      if (await this.state.storage.get(receipt)) return json2({ ok: true, replayed: true });
      const table = payload.tabela;
      const read = await googleFetch(
        this.base + SPREADSHEET_ID + "/values/" + encodeURIComponent(quoted(table) + "!A1:ZZ"),
        token
      );
      const rows = read.values || [];
      const headers = (rows[0] || []).map((x) => String(x).trim());
      if (!headers.length) return fail("A tabela oficial n\xE3o possui cabe\xE7alho.", 409, "SCHEMA_MISMATCH");
      const matches = rows.slice(1).flatMap((cells, i) => {
        const row = Object.fromEntries(headers.map((h, j) => [h, cells[j] ?? ""]));
        try {
          return idCritico(table, row) === idCritico(table, payload.registro) ? [{ index: i + 2, row }] : [];
        } catch {
          return [];
        }
      });
      if (matches.length > 1) return fail("Identificadores duplicados na planilha; opera\xE7\xE3o bloqueada.", 409, "DUPLICATE_ID");
      const remote = matches[0]?.row ?? null;
      const divergencias = compararVersaoDeCampos(table, payload.registro, payload.esperado, remote, headers, payload.tipo);
      if (divergencias.length) return fail("Conflito de vers\xE3o ou registro inexistente. Atualize e revise a altera\xE7\xE3o antes de reenviar.", 409, "VERSION_CONFLICT");
      const registro = adaptarRegistroCritico(table, payload.registro);
      const columns = headers.map((h, index) => ({ h, index })).filter((x) => Object.prototype.hasOwnProperty.call(registro, x.h));
      if (payload.tipo === "DELETE") {
        const meta = await googleFetch(
          this.base + SPREADSHEET_ID + "?fields=" + encodeURIComponent("sheets(properties(title,sheetId))"),
          token
        );
        const sheet = (meta.sheets || []).find((x) => x.properties.title === table);
        if (!sheet) return fail("Aba n\xE3o encontrada.", 409, "SCHEMA_MISMATCH");
        await googleFetch(this.base + SPREADSHEET_ID + ":batchUpdate", token, {
          method: "POST",
          body: JSON.stringify({ requests: [{ deleteDimension: { range: {
            sheetId: sheet.properties.sheetId,
            dimension: "ROWS",
            startIndex: matches[0].index - 1,
            endIndex: matches[0].index
          } } }] })
        });
      } else if (payload.tipo === "INSERT") {
        if (!columns.length) return fail("Nenhuma coluna correspondente.", 409, "SCHEMA_MISMATCH");
        const values = headers.map((h) => {
          const v = registro[h];
          return v == null ? "" : typeof v === "boolean" ? v ? "TRUE" : "FALSE" : v;
        });
        await googleFetch(this.base + SPREADSHEET_ID + "/values/" + encodeURIComponent(quoted(table) + "!A1:ZZ") + ":append?valueInputOption=RAW", token, {
          method: "POST",
          body: JSON.stringify({ values: [values] })
        });
      } else {
        if (!columns.length) return fail("Nenhuma coluna correspondente.", 409, "SCHEMA_MISMATCH");
        const data = columns.map(({ h, index }) => {
          const v = registro[h];
          return {
            range: quoted(table) + "!" + colName(index) + matches[0].index,
            values: [[v == null ? "" : typeof v === "boolean" ? v ? "TRUE" : "FALSE" : v]]
          };
        });
        await googleFetch(this.base + SPREADSHEET_ID + "/values:batchUpdate", token, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data }) });
      }
      await this.state.storage.put(receipt, { ok: true, at: Date.now() });
      const linhaLog = linhaDeLog(
        payload.operacaoId,
        (/* @__PURE__ */ new Date()).toISOString(),
        usuarioVerificado,
        table,
        payload.tipo,
        resumirAlteracaoParaLog(table, payload.tipo, payload.registro, remote, headers)
      );
      let auditoria = true;
      try {
        await anexarLog(this.base, token, linhaLog);
      } catch {
        auditoria = false;
        await this.guardarLogPendente(linhaLog);
      }
      return json2({ ok: true, replayed: false, auditoria });
    } catch (error) {
      return fail(
        error?.http === 401 ? "Sess\xE3o Google expirada." : error?.message || "Falha no servidor.",
        error?.http === 401 ? 401 : error?.http === 403 ? 403 : 502
      );
    }
  }
};
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/critical-write" && url.pathname !== "/api/acesso") return env.ASSETS.fetch(request);
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return fail("Origem n\xE3o permitida.", 403);
    const auth = await autorizarAdministrador(request.headers.get("X-Firebase-Id-Token"), env);
    if (url.pathname === "/api/acesso") {
      if (request.method !== "GET") return fail("M\xE9todo n\xE3o permitido.", 405);
      return auth.ok ? json2({ ok: true, email: auth.email, papel: "ADMINISTRADORA" }) : fail(auth.message, auth.status, auth.code);
    }
    if (request.method !== "POST") return fail("M\xE9todo n\xE3o permitido.", 405);
    if (!auth.ok) return fail(auth.message, auth.status, auth.code);
    if (Number(request.headers.get("Content-Length") || 0) > LIMITE_CORPO) return fail("Opera\xE7\xE3o muito grande.", 413);
    const corpo = await lerCorpoLimitado(request, LIMITE_CORPO);
    if (corpo === null) return fail("Opera\xE7\xE3o muito grande.", 413);
    const object = env.WRITE_COORDINATOR.get(env.WRITE_COORDINATOR.idFromName(SPREADSHEET_ID));
    return object.fetch(new Request("https://internal/write", {
      method: "POST",
      headers: { Authorization: request.headers.get("Authorization") || "", "Content-Type": "application/json", "X-Usuario-Verificado": auth.email },
      body: corpo
    }));
  }
};

// ../../../root/.npm/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../root/.npm/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-cVQLcO/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../root/.npm/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-cVQLcO/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  WriteCoordinator,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
