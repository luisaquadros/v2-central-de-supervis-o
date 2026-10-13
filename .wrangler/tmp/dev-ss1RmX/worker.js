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

// src/server/acessos.ts
var OPERACOES_DELEGAVEIS = ["CHAMADA", "ENTREGAS", "DOCUMENTOS_VER"];
var emailValido = /* @__PURE__ */ __name((e) => typeof e === "string" && /^[^@\s]+@[^@\s]+$/.test(e.trim()), "emailValido");
function lerConfiguracaoAcessos(env) {
  const administradoras = /* @__PURE__ */ new Set(), monitoras = /* @__PURE__ */ new Map(), avisos = [];
  for (const e of (env.ADMIN_EMAILS ?? "").split(/[,;\s]+/)) if (emailValido(e)) administradoras.add(e.trim().toLowerCase());
  if (env.ACESSOS_JSON?.trim()) {
    try {
      const j = JSON.parse(env.ACESSOS_JSON);
      for (const e of j.administradoras ?? []) if (emailValido(e)) administradoras.add(e.trim().toLowerCase());
      else avisos.push("administradora com e-mail inv\xE1lido ignorada");
      for (const m of j.monitoras ?? []) {
        if (!emailValido(m.email)) {
          avisos.push("monitora com e-mail inv\xE1lido ignorada");
          continue;
        }
        const turmas = Array.isArray(m.turmas) ? m.turmas.filter((t) => typeof t === "string" && t.trim() !== "" && t !== "*").map((t) => t.trim()) : [];
        const operacoes = Array.isArray(m.operacoes) ? m.operacoes.filter((o) => OPERACOES_DELEGAVEIS.includes(o)) : [];
        if (!turmas.length || !operacoes.length) {
          avisos.push("monitora sem turmas ou sem opera\xE7\xF5es delegadas ignorada (acesso restrito exige os dois)");
          continue;
        }
        monitoras.set(m.email.trim().toLowerCase(), { turmas, operacoes });
      }
    } catch {
      avisos.push("ACESSOS_JSON inv\xE1lido: nenhuma monitora foi habilitada");
    }
  }
  return { administradoras, monitoras, avisos };
}
__name(lerConfiguracaoAcessos, "lerConfiguracaoAcessos");
var acessosConfigurados = /* @__PURE__ */ __name((c) => c.administradoras.size > 0 || c.monitoras.size > 0, "acessosConfigurados");
function resolverPerfil(email, c) {
  const e = email.toLowerCase();
  if (c.administradoras.has(e)) return { papel: "PROFESSORA_ADMIN", email: e, turmas: ["*"], operacoes: [...OPERACOES_DELEGAVEIS] };
  const m = c.monitoras.get(e);
  return m ? { papel: "MONITORA", email: e, turmas: m.turmas, operacoes: m.operacoes } : null;
}
__name(resolverPerfil, "resolverPerfil");
var ESCRITA_POR_OPERACAO = { CHAMADA: ["frequencias", "encontros_turma"], ENTREGAS: ["entregas"], DOCUMENTOS_VER: [] };
var nega = /* @__PURE__ */ __name((code, message) => ({ ok: false, code, message }), "nega");
function podeEscreverTabela(p, tabela, tipo) {
  if (p.papel === "PROFESSORA_ADMIN") return { ok: true };
  if (tipo === "DELETE") return nega("OPERACAO_NAO_DELEGADA", "Monitoras n\xE3o excluem registros.");
  const liberadas = new Set(p.operacoes.flatMap((o) => ESCRITA_POR_OPERACAO[o]));
  return liberadas.has(tabela) ? { ok: true } : nega("OPERACAO_NAO_DELEGADA", "Esta opera\xE7\xE3o n\xE3o foi delegada a esta conta.");
}
__name(podeEscreverTabela, "podeEscreverTabela");
function turmaPermitida(p, turmaId) {
  if (p.papel === "PROFESSORA_ADMIN") return { ok: true };
  if (!turmaId) return nega("TURMA_INDETERMINADA", "N\xE3o foi poss\xEDvel determinar a turma do registro; grava\xE7\xE3o negada.");
  return p.turmas.includes(turmaId) ? { ok: true } : nega("FORA_DA_TURMA", "Registro de uma turma que n\xE3o foi delegada a esta conta.");
}
__name(turmaPermitida, "turmaPermitida");
function turmaDoRegistro(registro, turmaDaMatricula) {
  if (!registro) return void 0;
  const t = String(registro.turma_id ?? "").trim();
  if (t) return t;
  const m = String(registro.matricula_id ?? "").trim();
  return m ? turmaDaMatricula(m) : void 0;
}
__name(turmaDoRegistro, "turmaDoRegistro");
var LEITURA_MONITORA = {
  periodos: { todas: true },
  disciplinas: { todas: true },
  turmas: { porTurma: "turma_id" },
  horarios_turma: { porTurma: "turma_id" },
  matriculas: { porTurma: "turma_id" },
  alunos: { porTurma: "aluno_id", ocultar: ["email"] },
  grupos_pratica: { porTurma: "turma_id" },
  grupo_integrantes: { porTurma: "grupo_id" },
  encontros_turma: { operacao: "CHAMADA", porTurma: "turma_id", ocultar: ["observacao"] },
  frequencias: { operacao: "CHAMADA", porTurma: "matricula_id", ocultar: ["justificativa", "observacao"] },
  entregas: { operacao: "ENTREGAS", porTurma: "matricula_id", ocultar: ["observacao"] },
  monitoramento_documentos: { operacao: "DOCUMENTOS_VER", porTurma: "turma_id", ocultar: ["observacao", "observacao_manual"] }
};
var tabelaLegivelPor = /* @__PURE__ */ __name((p, tabela) => p.papel === "PROFESSORA_ADMIN" || tabela in LEITURA_MONITORA && (!LEITURA_MONITORA[tabela].operacao || p.operacoes.includes(LEITURA_MONITORA[tabela].operacao)), "tabelaLegivelPor");
var col = /* @__PURE__ */ __name((cab, nome) => cab.findIndex((h) => h.trim() === nome), "col");
function filtrarLeitura(tabela, valores, p, ctx) {
  if (!tabelaLegivelPor(p, tabela)) return null;
  if (p.papel === "PROFESSORA_ADMIN" || !valores.length) return valores;
  const regra = LEITURA_MONITORA[tabela];
  const cab = valores[0].map((c) => String(c ?? "").trim());
  const turmasOk = new Set(p.turmas);
  const matsOk = /* @__PURE__ */ new Map();
  for (const m of ctx.matriculas) if (turmasOk.has(String(m.turma_id ?? "").trim())) matsOk.set(String(m.matricula_id ?? "").trim(), String(m.aluno_id ?? "").trim());
  const alunosOk = new Set(matsOk.values());
  const gruposOk = new Set(ctx.grupos.filter((g) => turmasOk.has(String(g.turma_id ?? "").trim())).map((g) => String(g.grupo_id ?? "").trim()));
  let linhas = valores.slice(1);
  if (!regra.todas && regra.porTurma) {
    const i = col(cab, regra.porTurma);
    if (i < 0) return [valores[0]];
    const ok = regra.porTurma === "turma_id" ? turmasOk : regra.porTurma === "matricula_id" ? new Set(matsOk.keys()) : regra.porTurma === "aluno_id" ? alunosOk : gruposOk;
    linhas = linhas.filter((l) => ok.has(String(l[i] ?? "").trim()));
  }
  const ocultas = new Set((regra.ocultar ?? []).map((o) => cab.indexOf(o)).filter((i) => i >= 0));
  const manter = /* @__PURE__ */ __name((_, i) => !ocultas.has(i), "manter");
  return [cab.filter(manter), ...linhas.map((l) => cab.map((_, i) => l[i] ?? "").filter(manter))];
}
__name(filtrarLeitura, "filtrarLeitura");

// src/server/autorizacao.ts
var PROJETO_FIREBASE_PADRAO = "gen-lang-client-0003708748";
var URL_JWKS_PADRAO = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
var loopback = /* @__PURE__ */ __name((u) => /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u), "loopback");
function urlJwks(env) {
  return env.JWKS_URL && loopback(env.JWKS_URL) ? env.JWKS_URL : URL_JWKS_PADRAO;
}
__name(urlJwks, "urlJwks");
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
async function autenticarPerfil(idToken, env, agoraMs = Date.now(), buscar = fetch) {
  const config = lerConfiguracaoAcessos(env);
  if (!acessosConfigurados(config)) return {
    ok: false,
    status: 503,
    code: "ACESSO_NAO_CONFIGURADO",
    message: "Acesso n\xE3o configurado: defina ADMIN_EMAILS (e, se houver monitoras, ACESSOS_JSON) no Worker. Enquanto isso nada \xE9 aceito."
  };
  if (!idToken) return { ok: false, status: 401, code: "TOKEN_AUSENTE", message: "Identidade n\xE3o informada. Entre novamente com a conta Google." };
  let id;
  try {
    id = await verificarIdTokenFirebase(idToken, env, agoraMs, buscar);
  } catch {
    return { ok: false, status: 401, code: "TOKEN_INVALIDO", message: "Identidade inv\xE1lida ou expirada. Entre novamente com a conta Google." };
  }
  const perfil = resolverPerfil(id.email, config);
  if (!perfil) return { ok: false, status: 403, code: "NAO_AUTORIZADO", message: "Esta conta n\xE3o tem permiss\xE3o neste sistema." };
  return { ok: true, perfil, config };
}
__name(autenticarPerfil, "autenticarPerfil");

// src/server/contaServico.ts
var ESCOPO_SHEETS = "https://www.googleapis.com/auth/spreadsheets";
var ESCOPO_DRIVE_METADADOS = "https://www.googleapis.com/auth/drive.metadata.readonly";
var TOKEN_URL_PADRAO = "https://oauth2.googleapis.com/token";
var loopback2 = /* @__PURE__ */ __name((u) => /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u), "loopback");
var ContaServicoIndisponivel = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
  static {
    __name(this, "ContaServicoIndisponivel");
  }
};
var b64url2 = /* @__PURE__ */ __name((b) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}, "b64url");
var cache = /* @__PURE__ */ new Map();
function urlDoToken(env) {
  return env.TOKEN_URL && loopback2(env.TOKEN_URL) ? env.TOKEN_URL : TOKEN_URL_PADRAO;
}
__name(urlDoToken, "urlDoToken");
async function importarChave(pem) {
  const corpo = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  try {
    return await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(corpo), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch {
    throw new ContaServicoIndisponivel("CHAVE_INVALIDA", "A chave da conta de servi\xE7o \xE9 inv\xE1lida.");
  }
}
__name(importarChave, "importarChave");
async function tokenContaServico(env, escopos, agoraMs = Date.now(), buscar = fetch) {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new ContaServicoIndisponivel("NAO_CONFIGURADA", "Conta de servi\xE7o n\xE3o configurada (GOOGLE_SERVICE_ACCOUNT_JSON).");
  const chaveCache = escopos.slice().sort().join(" ");
  const c = cache.get(chaveCache);
  if (c && c.ate > agoraMs + 6e4) return c.token;
  let cred;
  try {
    cred = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new ContaServicoIndisponivel("CHAVE_INVALIDA", "GOOGLE_SERVICE_ACCOUNT_JSON n\xE3o \xE9 um JSON v\xE1lido.");
  }
  if (!cred.client_email || !cred.private_key) throw new ContaServicoIndisponivel("CHAVE_INVALIDA", "Faltam client_email/private_key na conta de servi\xE7o.");
  const url = urlDoToken(env), s = Math.floor(agoraMs / 1e3);
  const cab = b64url2(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url2(JSON.stringify({ iss: cred.client_email, scope: escopos.join(" "), aud: url, iat: s, exp: s + 3600 }));
  const assinatura = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await importarChave(cred.private_key), new TextEncoder().encode(cab + "." + claims));
  const r = await buscar(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: cab + "." + claims + "." + b64url2(assinatura) }),
    signal: AbortSignal.timeout(15e3)
  });
  if (!r.ok) throw new ContaServicoIndisponivel("TOKEN_RECUSADO", `O Google recusou a conta de servi\xE7o (HTTP ${r.status}).`);
  const j = await r.json();
  if (!j.access_token) throw new ContaServicoIndisponivel("TOKEN_RECUSADO", "Resposta do Google sem access_token.");
  cache.set(chaveCache, { token: j.access_token, ate: agoraMs + (j.expires_in ?? 3600) * 1e3 });
  return j.access_token;
}
__name(tokenContaServico, "tokenContaServico");

// src/server/sincronizacaoDocumentos.ts
var ABA_MONITORAMENTO = "monitoramento_documentos";
var CRONS_SINCRONIZACAO = ["0 11 * * *", "0 21 * * *"];
var HORARIOS_BRASILIA = { "0 11 * * *": "08:00", "0 21 * * *": "18:00" };
var JANELA_PADRAO_DIAS = 7;
var COLUNAS_ESCRITAS = ["data_modificacao_drive", "consultado_em", "status", "erro_codigo"];
var colName = /* @__PURE__ */ __name((i) => {
  let n = i + 1, o = "";
  while (n > 0) {
    n--;
    o = String.fromCharCode(65 + n % 26) + o;
    n = Math.floor(n / 26);
  }
  return o;
}, "colName");
var q = /* @__PURE__ */ __name((n) => `'${n.replaceAll("'", "''")}'`, "q");
function classificarDocumento(resposta, pastaEsperada, agora, janelaDias2) {
  const s = resposta.status;
  if (s === 404) return { status: "NAO_ENCONTRADO_NA_PASTA", erro: "DRIVE_404", transitorio: false };
  if (s === 403) return { status: "SEM_PERMISSAO", erro: "DRIVE_403", transitorio: false };
  if (s !== 200) return { status: null, erro: s === 0 ? "REDE" : `DRIVE_${s}`, transitorio: true };
  const c = resposta.corpo ?? {};
  if (c.trashed) return { status: "NAO_ENCONTRADO_NA_PASTA", modificado: c.modifiedTime, erro: "LIXEIRA", transitorio: false };
  if (pastaEsperada && Array.isArray(c.parents) && c.parents.length && !c.parents.includes(pastaEsperada))
    return { status: "NAO_ENCONTRADO_NA_PASTA", modificado: c.modifiedTime, erro: "FORA_DA_PASTA", transitorio: false };
  const t = c.modifiedTime ? Date.parse(c.modifiedTime) : NaN;
  if (!Number.isFinite(t)) return { status: "A_CONFERIR", erro: "SEM_DATA", transitorio: false };
  const recente = agora.getTime() - t <= janelaDias2 * 864e5;
  return { status: recente ? "LOCALIZADO_RECENTE" : "LOCALIZADO_ANTIGO", modificado: c.modifiedTime, erro: "", transitorio: false };
}
__name(classificarDocumento, "classificarDocumento");
async function sincronizarDocumentos(d, modo, cron) {
  const buscar = d.buscar ?? fetch, janela = d.janelaDias ?? JANELA_PADRAO_DIAS, inicio = d.agora.toISOString();
  const base = d.sheetsBase + d.planilhaId, hdrS = { Authorization: "Bearer " + d.tokenSheets };
  const erros = {};
  const conta = /* @__PURE__ */ __name((c) => {
    erros[c] = (erros[c] ?? 0) + 1;
  }, "conta");
  const encerrar = /* @__PURE__ */ __name((status, x = {}) => {
    const fim = (/* @__PURE__ */ new Date()).toISOString();
    const resultado = { status, modo, cron, inicio, fim, janelaDias: janela, lidos: 0, consultados: 0, atualizados: 0, erros, ...x };
    const resumoErros = Object.entries(erros).map(([c, n]) => `${c}\xD7${n}`).join(", ");
    return { resultado, linhaHistorico: [
      "DRIVE_METADADOS",
      "",
      ABA_MONITORAMENTO,
      modo,
      status === "FALHA" ? "FALHA" : "OK",
      `inicio=${inicio};fim=${fim};janela=${janela}d${cron ? ";cron=" + cron : ""}`,
      status,
      String(resultado.lidos),
      String(resultado.atualizados),
      (resumoErros || resultado.mensagem || "").slice(0, 300)
    ] };
  }, "encerrar");
  let rows;
  try {
    const r = await buscar(`${base}/values/${encodeURIComponent(q(ABA_MONITORAMENTO) + "!A1:ZZ")}`, { headers: hdrS, signal: AbortSignal.timeout(2e4) });
    if (!r.ok) {
      conta(r.status === 400 ? "ABA_AUSENTE" : `SHEETS_${r.status}`);
      return encerrar("FALHA", { mensagem: r.status === 400 ? "Aba monitoramento_documentos n\xE3o encontrada." : `Planilha respondeu ${r.status}.` });
    }
    rows = (await r.json()).values ?? [];
  } catch {
    conta("REDE_SHEETS");
    return encerrar("FALHA", { mensagem: "Sem conex\xE3o com a planilha." });
  }
  const cab = (rows[0] ?? []).map((c) => String(c ?? "").trim());
  const idx = /* @__PURE__ */ __name((n) => cab.indexOf(n), "idx");
  if (idx("arquivo_id") < 0 || COLUNAS_ESCRITAS.every((c) => idx(c) < 0)) {
    conta("CABECALHO_INCOMPATIVEL");
    return encerrar("FALHA", { mensagem: "Cabe\xE7alho sem arquivo_id ou sem colunas de status." });
  }
  const alvos = rows.slice(1).map((r, i) => ({ linha: i + 2, r })).filter((x) => String(x.r[idx("arquivo_id")] ?? "").trim() !== "");
  const ids = [...new Set(alvos.map((x) => String(x.r[idx("arquivo_id")]).trim()))];
  const respostas = /* @__PURE__ */ new Map();
  let fatal = false;
  for (let i = 0; i < ids.length && !fatal; i += 5) {
    await Promise.all(ids.slice(i, i + 5).map(async (id) => {
      try {
        const r = await buscar(
          `${d.driveBase}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent("id,modifiedTime,trashed,parents")}&supportsAllDrives=true`,
          { headers: { Authorization: "Bearer " + d.tokenDrive }, signal: AbortSignal.timeout(15e3) }
        );
        if (r.status === 401) {
          fatal = true;
          return;
        }
        respostas.set(id, { status: r.status, corpo: r.status === 200 ? await r.json() : void 0 });
      } catch {
        respostas.set(id, { status: 0 });
      }
    }));
  }
  if (fatal) {
    conta("TOKEN_DRIVE_RECUSADO");
    return encerrar("FALHA", { lidos: alvos.length, mensagem: "O Drive recusou a conta de servi\xE7o (401)." });
  }
  const dados = [];
  let atualizados = 0;
  for (const { linha, r } of alvos) {
    const id = String(r[idx("arquivo_id")]).trim();
    const c = classificarDocumento(respostas.get(id) ?? { status: 0 }, String(r[idx("pasta_id")] ?? "").trim(), d.agora, janela);
    if (c.erro) conta(c.erro);
    const novo = { consultado_em: inicio, erro_codigo: c.erro };
    if (c.transitorio) {
      if (!String(r[idx("status")] ?? "").trim()) novo.status = "NAO_VERIFICADO";
      delete novo.consultado_em;
    } else {
      novo.status = c.status;
      if (c.modificado) novo.data_modificacao_drive = c.modificado;
    }
    let mudou = false;
    for (const col2 of COLUNAS_ESCRITAS) {
      const i = idx(col2);
      if (i < 0 || !(col2 in novo)) continue;
      const atual = String(r[i] ?? "");
      if (col2 === "consultado_em" || atual !== novo[col2]) {
        dados.push({ range: `${q(ABA_MONITORAMENTO)}!${colName(i)}${linha}`, values: [[novo[col2]]] });
        if (col2 !== "consultado_em") mudou = true;
      }
    }
    if (mudou) atualizados++;
  }
  try {
    if (dados.length) {
      const w = await buscar(`${base}/values:batchUpdate`, {
        method: "POST",
        headers: { ...hdrS, "Content-Type": "application/json" },
        body: JSON.stringify({ valueInputOption: "RAW", data: dados }),
        signal: AbortSignal.timeout(2e4)
      });
      if (!w.ok) {
        conta(`SHEETS_ESCRITA_${w.status}`);
        return encerrar("FALHA", { lidos: alvos.length, consultados: respostas.size, mensagem: `N\xE3o foi poss\xEDvel gravar na planilha (${w.status}).` });
      }
    }
  } catch {
    conta("REDE_SHEETS");
    return encerrar("FALHA", { lidos: alvos.length, consultados: respostas.size, mensagem: "Sem conex\xE3o ao gravar na planilha." });
  }
  const ACHADOS = ["DRIVE_404", "DRIVE_403", "LIXEIRA", "FORA_DA_PASTA", "SEM_DATA"];
  const tecnico = Object.keys(erros).some((c) => !ACHADOS.includes(c));
  return encerrar(tecnico ? "PARCIAL" : "SUCESSO", { lidos: alvos.length, consultados: respostas.size, atualizados });
}
__name(sincronizarDocumentos, "sincronizarDocumentos");

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
  "preparacoes_aula",
  // Cadastro: migrado uma tabela por vez (cada linha abaixo é um passo reversível, ver docs/DOCUMENTO_MESTRE.md)
  "alunos",
  "matriculas",
  "turmas",
  "horarios_turma"
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
  const t = String(valor).trim();
  if (/^(true|false)$/i.test(t)) return t.toUpperCase();
  return dataCanonica(t);
}
__name(valorComparavel, "valorComparavel");
var DIAS = { DOMINGO: "0", SEGUNDA: "1", TERCA: "2", "TER\xC7A": "2", QUARTA: "3", QUINTA: "4", SEXTA: "5", SABADO: "6", "S\xC1BADO": "6" };
function valorComparavelCampo(tabela, campo, valor) {
  const v = valorComparavel(valor);
  if (tabela === "horarios_turma" && campo === "dia_semana") return DIAS[v.toUpperCase()] ?? v;
  return v;
}
__name(valorComparavelCampo, "valorComparavelCampo");
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
    const original = valorComparavelCampo(tabela, key, base[key]);
    const atual = valorComparavelCampo(tabela, key, remoto[key]);
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
var DRIVE_PADRAO = "https://www.googleapis.com/drive/v3";
var driveBase = /* @__PURE__ */ __name((env) => {
  const o = env.DRIVE_API_BASE;
  return o && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(o) ? o.replace(/\/+$/, "") : DRIVE_PADRAO;
}, "driveBase");
var lerPerfil = /* @__PURE__ */ __name((request) => {
  try {
    const p = JSON.parse(request.headers.get("X-Perfil") || "null");
    return p && (p.papel === "PROFESSORA_ADMIN" || p.papel === "MONITORA") ? p : null;
  } catch {
    return null;
  }
}, "lerPerfil");
var json2 = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
}), "json");
var fail = /* @__PURE__ */ __name((message, status, code = "WRITE_FAILED") => json2({ ok: false, code, message }, status), "fail");
var colName2 = /* @__PURE__ */ __name((index) => {
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
var janelaDias = /* @__PURE__ */ __name((env) => {
  const n = Number(env.JANELA_DOCUMENTOS_DIAS);
  return Number.isInteger(n) && n >= 1 && n <= 90 ? n : JANELA_PADRAO_DIAS;
}, "janelaDias");
async function anexarEmAbaExistente(base, token, aba, linha) {
  await googleFetch(base + SPREADSHEET_ID + "/values/" + encodeURIComponent(quoted(aba) + "!A1") + ":append?valueInputOption=RAW", token, { method: "POST", body: JSON.stringify({ values: [linha] }) });
}
__name(anexarEmAbaExistente, "anexarEmAbaExistente");
var WriteCoordinator = class {
  constructor(state, env) {
    this.state = state;
    this.tail = Promise.resolve();
    this.sincronizando = false;
    this.env = env ?? {};
    this.base = baseSheets(this.env);
  }
  static {
    __name(this, "WriteCoordinator");
  }
  async fetch(request) {
    const caminho = new URL(request.url).pathname;
    if (caminho === "/estado") return this.estadoSincronizacao();
    if (caminho === "/sync") {
      if (this.sincronizando) return fail("J\xE1 existe uma sincroniza\xE7\xE3o em andamento.", 409, "SINCRONIZACAO_EM_ANDAMENTO");
      this.sincronizando = true;
      const t = /* @__PURE__ */ __name(() => this.performSync(request).finally(() => {
        this.sincronizando = false;
      }), "t");
      const r = this.tail.then(t, t);
      this.tail = r.then(() => void 0, () => void 0);
      return r;
    }
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
  async estadoSincronizacao() {
    const historico = await this.state.storage.get("sync-historico") || [];
    return json2({
      ok: true,
      ligada: this.env.SINCRONIZACAO_DOCUMENTOS === "ligada",
      em_andamento: this.sincronizando,
      janela_dias: janelaDias(this.env),
      agendamentos: CRONS_SINCRONIZACAO.map((c) => ({ cron: c, horario_brasilia: HORARIOS_BRASILIA[c] })),
      historico: historico.slice(0, 10)
    });
  }
  async registrarExecucao(resultado) {
    const atual = await this.state.storage.get("sync-historico") || [];
    await this.state.storage.put("sync-historico", [resultado, ...atual].slice(0, 30));
  }
  async performSync(request) {
    const agendado = request.headers.get("X-Agendado");
    const perfil = lerPerfil(request);
    if (!agendado && perfil?.papel !== "PROFESSORA_ADMIN") return fail("Somente a professora administradora sincroniza.", 403, "NAO_AUTORIZADO");
    if (this.env.SINCRONIZACAO_DOCUMENTOS !== "ligada") return fail("A sincroniza\xE7\xE3o de documentos est\xE1 desligada neste ambiente (SINCRONIZACAO_DOCUMENTOS).", 409, "SINCRONIZACAO_DESLIGADA");
    const modo = agendado ? "AGENDADO" : "MANUAL", inicio = /* @__PURE__ */ new Date();
    let token;
    try {
      token = await tokenContaServico(this.env, [ESCOPO_SHEETS, ESCOPO_DRIVE_METADADOS]);
    } catch (e) {
      const mensagem = e instanceof ContaServicoIndisponivel ? e.message : "Conta de servi\xE7o indispon\xEDvel.";
      await this.registrarExecucao({ status: "FALHA", modo, cron: agendado || void 0, inicio: inicio.toISOString(), fim: (/* @__PURE__ */ new Date()).toISOString(), lidos: 0, consultados: 0, atualizados: 0, erros: { CONTA_SERVICO: 1 }, mensagem });
      return fail(mensagem, 503, "CONTA_SERVICO_INDISPONIVEL");
    }
    const { resultado, linhaHistorico } = await sincronizarDocumentos({
      planilhaId: SPREADSHEET_ID,
      sheetsBase: this.base,
      driveBase: driveBase(this.env),
      tokenSheets: token,
      tokenDrive: token,
      agora: inicio,
      janelaDias: janelaDias(this.env)
    }, modo, agendado || void 0);
    await this.registrarExecucao(resultado);
    let historicoGravado = true;
    try {
      await anexarEmAbaExistente(this.base, token, "sincronizacao", linhaHistorico);
    } catch {
      historicoGravado = false;
    }
    try {
      await anexarLog(this.base, token, [
        "sync-" + inicio.getTime().toString(36),
        resultado.fim,
        "sistema:sincronizacao-documentos",
        ABA_MONITORAMENTO,
        "*",
        "SYNC",
        "data_modificacao_drive, consultado_em, status, erro_codigo",
        "{}",
        JSON.stringify({ status: resultado.status, lidos: resultado.lidos, atualizados: resultado.atualizados }),
        "CENTRAL_WORKER"
      ]);
    } catch {
      historicoGravado = false;
    }
    return json2({ ok: true, resultado, historico_gravado: historicoGravado });
  }
  async perform(request) {
    try {
      const perfil = lerPerfil(request);
      if (!perfil) return fail("Perfil verificado ausente.", 401, "TOKEN_AUSENTE");
      let token;
      if (perfil.papel === "MONITORA") {
        try {
          token = await tokenContaServico(this.env, [ESCOPO_SHEETS]);
        } catch (e) {
          return fail(e instanceof ContaServicoIndisponivel ? e.message : "Conta de servi\xE7o indispon\xEDvel.", 503, "CONTA_SERVICO_INDISPONIVEL");
        }
      } else {
        const bearer = request.headers.get("Authorization") || "";
        if (!/^Bearer \S+$/.test(bearer)) return fail("Autentica\xE7\xE3o Google necess\xE1ria.", 401);
        token = bearer.slice(7);
      }
      const usuarioVerificado = request.headers.get("X-Usuario-Verificado") || "";
      if (!usuarioVerificado) return fail("Identidade verificada ausente.", 401, "TOKEN_AUSENTE");
      const payload = await request.json();
      if (!payload || !TABELAS_CRITICAS.has(payload.tabela) || !["INSERT", "UPDATE", "DELETE"].includes(payload.tipo) || !payload.operacaoId || !/^[-a-zA-Z0-9_:]{8,100}$/.test(payload.operacaoId) || !payload.registro || typeof payload.registro !== "object")
        return fail("Opera\xE7\xE3o cr\xEDtica inv\xE1lida.", 400);
      const liberada = podeEscreverTabela(perfil, payload.tabela, payload.tipo);
      if (!liberada.ok) return fail(liberada.message, 403, liberada.code);
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
      if (perfil.papel === "MONITORA") {
        const mats = await googleFetch(this.base + SPREADSHEET_ID + "/values/" + encodeURIComponent(quoted("matriculas") + "!A1:ZZ"), token);
        const mr = mats.values || [];
        const mh = (mr[0] || []).map((x) => String(x).trim());
        const turmaPorMatricula = new Map(mr.slice(1).map((c) => [String(c[mh.indexOf("matricula_id")] ?? "").trim(), String(c[mh.indexOf("turma_id")] ?? "").trim()]));
        const busca = /* @__PURE__ */ __name((id) => turmaPorMatricula.get(id) || void 0, "busca");
        for (const alvo of [payload.registro, remote]) {
          if (!alvo) continue;
          const d = turmaPermitida(perfil, turmaDoRegistro(alvo, busca));
          if (!d.ok) return fail(d.message, 403, d.code);
        }
      }
      const divergencias = compararVersaoDeCampos(table, payload.registro, payload.esperado, remote, headers, payload.tipo);
      if (divergencias.length) return json2({
        ok: false,
        code: "VERSION_CONFLICT",
        campos: divergencias,
        message: "Conflito de vers\xE3o ou registro inexistente. Atualize e revise a altera\xE7\xE3o antes de reenviar."
      }, 409);
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
            range: quoted(table) + "!" + colName2(index) + matches[0].index,
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
var ROTAS_API = /* @__PURE__ */ new Set(["/api/critical-write", "/api/acesso", "/api/leitura", "/api/documentos/sincronizar", "/api/documentos/estado"]);
var coordenador = /* @__PURE__ */ __name((env) => env.WRITE_COORDINATOR.get(env.WRITE_COORDINATOR.idFromName(SPREADSHEET_ID)), "coordenador");
var perfilPublico = /* @__PURE__ */ __name((p) => ({ papel: p.papel, email: p.email, turmas: p.turmas, operacoes: p.operacoes }), "perfilPublico");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!ROTAS_API.has(url.pathname)) return env.ASSETS.fetch(request);
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return fail("Origem n\xE3o permitida.", 403);
    const auth = await autenticarPerfil(request.headers.get("X-Firebase-Id-Token"), env);
    if (!auth.ok) return fail(auth.message, auth.status, auth.code);
    const perfil = auth.perfil;
    if (url.pathname === "/api/acesso") {
      if (request.method !== "GET") return fail("M\xE9todo n\xE3o permitido.", 405);
      return json2({ ok: true, ...perfilPublico(perfil), avisos: perfil.papel === "PROFESSORA_ADMIN" ? auth.config.avisos : [] });
    }
    if (url.pathname === "/api/leitura") {
      if (request.method !== "GET") return fail("M\xE9todo n\xE3o permitido.", 405);
      const pedidas = (url.searchParams.get("tabelas") || "").split(",").map((x) => x.trim()).filter(Boolean);
      if (!pedidas.length || pedidas.length > 60) return fail("Informe as tabelas (at\xE9 60).", 400, "PEDIDO_INVALIDO");
      const negadas = pedidas.filter((t) => !tabelaLegivelPor(perfil, t));
      if (negadas.length) return fail("Tabela n\xE3o dispon\xEDvel para este perfil: " + negadas.join(", ") + ".", 403, "TABELA_NAO_DELEGADA");
      let token;
      try {
        token = await tokenContaServico(env, [ESCOPO_SHEETS]);
      } catch (e) {
        return fail(e instanceof ContaServicoIndisponivel ? e.message : "Conta de servi\xE7o indispon\xEDvel.", 503, "CONTA_SERVICO_INDISPONIVEL");
      }
      const base = baseSheets(env) + SPREADSHEET_ID;
      const contexto = perfil.papel === "MONITORA" ? ["matriculas", "grupos_pratica"] : [];
      const todas = [.../* @__PURE__ */ new Set([...pedidas, ...contexto])];
      const lido = {};
      try {
        const r = await googleFetch(base + "/values:batchGet?" + todas.map((t) => "ranges=" + encodeURIComponent(quoted(t) + "!A1:ZZ")).join("&"), token);
        todas.forEach((t, i) => {
          lido[t] = r.valueRanges?.[i]?.values || [];
        });
      } catch (e) {
        return fail(e?.message || "Falha na leitura.", e?.http === 403 ? 403 : 502, "LEITURA_FALHOU");
      }
      const objs = /* @__PURE__ */ __name((t) => {
        const v = lido[t] || [];
        const h = (v[0] || []).map((x) => String(x).trim());
        return v.slice(1).map((l) => Object.fromEntries(h.map((c, i) => [c, l[i] ?? ""])));
      }, "objs");
      const tabelas = {};
      for (const t of pedidas) tabelas[t] = { values: filtrarLeitura(t, lido[t] || [], perfil, { matriculas: objs("matriculas"), grupos: objs("grupos_pratica") }) || [] };
      return json2({ ok: true, papel: perfil.papel, tabelas });
    }
    if (url.pathname === "/api/documentos/estado") {
      if (request.method !== "GET") return fail("M\xE9todo n\xE3o permitido.", 405);
      if (perfil.papel !== "PROFESSORA_ADMIN" && !perfil.operacoes.includes("DOCUMENTOS_VER")) return fail("Sem permiss\xE3o para ver a sincroniza\xE7\xE3o de documentos.", 403, "OPERACAO_NAO_DELEGADA");
      return coordenador(env).fetch(new Request("https://internal/estado", { method: "GET" }));
    }
    if (url.pathname === "/api/documentos/sincronizar") {
      if (request.method !== "POST") return fail("M\xE9todo n\xE3o permitido.", 405);
      if (perfil.papel !== "PROFESSORA_ADMIN") return fail("Somente a professora administradora sincroniza.", 403, "NAO_AUTORIZADO");
      return coordenador(env).fetch(new Request("https://internal/sync", { method: "POST", headers: { "X-Perfil": JSON.stringify(perfilPublico(perfil)) } }));
    }
    if (request.method !== "POST") return fail("M\xE9todo n\xE3o permitido.", 405);
    if (Number(request.headers.get("Content-Length") || 0) > LIMITE_CORPO) return fail("Opera\xE7\xE3o muito grande.", 413);
    const corpo = await lerCorpoLimitado(request, LIMITE_CORPO);
    if (corpo === null) return fail("Opera\xE7\xE3o muito grande.", 413);
    return coordenador(env).fetch(new Request("https://internal/write", {
      method: "POST",
      headers: { Authorization: request.headers.get("Authorization") || "", "Content-Type": "application/json", "X-Usuario-Verificado": perfil.email, "X-Perfil": JSON.stringify(perfilPublico(perfil)) },
      body: corpo
    }));
  },
  /** Cron Triggers. Só age se SINCRONIZACAO_DOCUMENTOS='ligada' e se o cron é um dos dois horários previstos. */
  async scheduled(event, env, ctx) {
    if (env.SINCRONIZACAO_DOCUMENTOS !== "ligada") return;
    if (!CRONS_SINCRONIZACAO.includes(event.cron)) return;
    ctx.waitUntil(coordenador(env).fetch(new Request("https://internal/sync", { method: "POST", headers: { "X-Agendado": event.cron } })).then(() => void 0));
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
