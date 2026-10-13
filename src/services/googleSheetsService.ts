/**
 * Acesso à planilha oficial (Google Sheets API v4) e login Google (Firebase Auth).
 *
 * Regras de segurança da gravação:
 * - Atualização grava SOMENTE as células alteradas: colunas calculadas por fórmula e dados
 *   importados nunca são reescritos.
 * - Valores são gravados como RAW (texto digitado nunca vira fórmula).
 * - Abas geradas por fórmula são somente leitura (ver tabelas.ts).
 * - Exclusão só acontece quando a chave identifica exatamente uma linha.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { recordIdentity } from './recordIdentity';
import {
  CHAVE_PRIMARIA,
  CAMPOS_EDITAVEIS,
  COLUNAS_DAS_ABAS_DO_APP,
  COLUNAS_EXTRAS_PERMITIDAS,
  TABELAS_GRAVAVEIS,
  TABELAS_LIDAS,
  TABELAS_SOMENTE_ATUALIZACAO,
  TabelaBase,
} from './tabelas';
import {
  adaptarParaPlanilha,
  letraColuna,
  normalizarLinhasDaAba,
  parseSheetRowsToObjects,
  serializarValor,
} from './normalizacaoPlanilha';

export { normalizarLinhasDaAba, normalizarDataAcademica } from './normalizacaoPlanilha';

export const OFFICIAL_SPREADSHEET_ID = '1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4';
export const OFFICIAL_SPREADSHEET_NAME = 'Central de Supervisão - DESENVOLVIMENTO';
export const OFFICIAL_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${OFFICIAL_SPREADSHEET_ID}`;

const API = `https://sheets.googleapis.com/v4/spreadsheets/${OFFICIAL_SPREADSHEET_ID}`;
const LEITURA_BRUTA = 'valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER';

function fetchWithTimeout(input: string, init?: RequestInit) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(20000) });
}

// ---------------------------------------------------------------------------
// LOGIN GOOGLE
// ---------------------------------------------------------------------------

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

// O token do Google vale 1 hora; guardamos só na sessão da aba (nunca no localStorage).
const SESSION_TOKEN_KEY = 'cs_google_access_token_session';
const SESSION_EXPIRY_KEY = 'cs_google_access_token_exp';
const VALIDADE_TOKEN_MS = 55 * 60 * 1000;
let accessTokenExpiresAt = 0;

function saveTokenToSession(token: string) {
  accessTokenExpiresAt = Date.now() + VALIDADE_TOKEN_MS;
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    sessionStorage.setItem(SESSION_EXPIRY_KEY, String(accessTokenExpiresAt));
  } catch { /* sessão privada: o token fica só em memória */ }
}

function getStoredTokenFromSession(): string | null {
  try {
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    const exp = Number(sessionStorage.getItem(SESSION_EXPIRY_KEY));
    if (token && exp && Date.now() < exp) {
      accessTokenExpiresAt = exp;
      return token;
    }
  } catch { /* indisponível */ }
  clearSessionToken();
  return null;
}

function clearSessionToken() {
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_EXPIRY_KEY);
  } catch { /* indisponível */ }
}

let inMemoryAccessToken: string | null = typeof sessionStorage !== 'undefined' ? getStoredTokenFromSession() : null;
let isSigningIn = false;

export const initAuth = (onAuthSuccess?: (user: User) => void, onAuthFailure?: () => void) =>
  onAuthStateChanged(auth, (user: User | null) => {
    if (user) onAuthSuccess?.(user);
    else if (!isSigningIn) onAuthFailure?.();
  });

/** Abre o login do Google. Quando já há uma conta conectada, pula a escolha de conta. */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  isSigningIn = true;
  try {
    const email = auth.currentUser?.email;
    provider.setCustomParameters(email ? { login_hint: email } : {});
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) throw new Error('Falha ao obter token de acesso do Google.');
    inMemoryAccessToken = credential.accessToken;
    saveTokenToSession(credential.accessToken);
    return { user: result.user, accessToken: credential.accessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (inMemoryAccessToken && Date.now() < accessTokenExpiresAt) return inMemoryAccessToken;
  inMemoryAccessToken = getStoredTokenFromSession();
  return inMemoryAccessToken;
};

/** Apenas para testes automatizados. */
export const setMockToken = (token: string | null) => {
  inMemoryAccessToken = token;
  if (token) saveTokenToSession(token);
  else clearSessionToken();
};

export const clearAccessToken = () => {
  inMemoryAccessToken = null;
  clearSessionToken();
};

export const googleLogout = async () => {
  await signOut(auth);
  clearAccessToken();
};

async function exigirToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com Google Workspace.');
  return token;
}

async function falhaHttp(res: Response, contexto: string): Promise<never> {
  if (res.status === 401) {
    clearAccessToken();
    throw new Error('Sessão expirada do Google. É necessário autenticar novamente.');
  }
  if (res.status === 429) throw new Error('Limite de uso do Google atingido. Nova tentativa em instantes.');
  const corpo = await res.json().catch(() => null);
  throw new Error(corpo?.error?.message || `${contexto} (HTTP ${res.status}).`);
}

// ---------------------------------------------------------------------------
// ABAS DA PLANILHA
// ---------------------------------------------------------------------------

interface AbaInfo { title: string; sheetId: number; columnCount: number }
let cacheAbas: AbaInfo[] | null = null;
let cacheAbasEm = 0;

async function obterAbas(token: string, forcar = false): Promise<AbaInfo[]> {
  if (!forcar && cacheAbas && Date.now() - cacheAbasEm < 300000) return cacheAbas;
  const res = await fetchWithTimeout(`${API}?fields=sheets.properties(sheetId,title,gridProperties(columnCount))`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) await falhaHttp(res, 'Não foi possível listar as abas da planilha');
  const meta = await res.json();
  cacheAbas = (meta.sheets || []).map((s: any) => ({
    title: String(s.properties?.title || ''),
    sheetId: Number(s.properties?.sheetId ?? 0),
    columnCount: Number(s.properties?.gridProperties?.columnCount ?? 26),
  })).filter((a: AbaInfo) => a.title);
  cacheAbasEm = Date.now();
  return cacheAbas!;
}

export function normalizarChaveAba(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[\s\-_]+/g, '_');
}

/** Encontra a aba pelo nome canônico, tolerando acentos, espaços e conectivos (de/da/do). */
function encontrarAba(abas: AbaInfo[], tabela: string): AbaInfo | undefined {
  const alvo = normalizarChaveAba(tabela);
  const semConectivo = (s: string) => s.replace(/_(de|da|do)_/g, '_');
  return abas.find(a => a.title === tabela)
    || abas.find(a => normalizarChaveAba(a.title) === alvo)
    || abas.find(a => semConectivo(normalizarChaveAba(a.title)) === semConectivo(alvo));
}

export function formatarRangeSheet(nomeRealAba: string, range?: string): string {
  const quoted = `'${nomeRealAba.replace(/'/g, "''")}'`;
  return range ? `${quoted}!${range}` : quoted;
}

async function lerValores(token: string, titulo: string): Promise<unknown[][]> {
  const range = encodeURIComponent(formatarRangeSheet(titulo, 'A1:ZZ'));
  const res = await fetchWithTimeout(`${API}/values/${range}?${LEITURA_BRUTA}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) await falhaHttp(res, `Falha ao ler a aba ${titulo}`);
  return (await res.json()).values || [];
}

async function escreverCelulas(token: string, data: { range: string; values: string[][] }[]) {
  if (data.length === 0) return;
  const res = await fetchWithTimeout(`${API}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  });
  if (!res.ok) await falhaHttp(res, 'Falha ao atualizar células na planilha');
}

async function estruturaPlanilha(token: string, requests: unknown[]) {
  const res = await fetchWithTimeout(`${API}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) await falhaHttp(res, 'Falha ao ajustar a estrutura da planilha');
  return res.json().catch(() => ({}));
}

/** Cria uma aba do app (ex.: tarefas_professora) com o cabeçalho padrão. */
async function criarAba(token: string, tabela: string, colunas: string[]): Promise<AbaInfo> {
  await estruturaPlanilha(token, [{
    addSheet: { properties: { title: tabela, gridProperties: { rowCount: 1000, columnCount: Math.max(26, colunas.length) } } },
  }]);
  await escreverCelulas(token, [{ range: formatarRangeSheet(tabela, 'A1'), values: [colunas] }]);
  const aba = encontrarAba(await obterAbas(token, true), tabela);
  if (!aba) throw new Error(`Não foi possível criar a aba ${tabela}.`);
  return aba;
}

/** Acrescenta colunas ao fim do cabeçalho, sem mexer nas existentes. */
async function acrescentarColunas(token: string, aba: AbaInfo, totalAtual: number, novas: string[]) {
  const necessario = totalAtual + novas.length;
  if (necessario > aba.columnCount) {
    await estruturaPlanilha(token, [{
      appendDimension: { sheetId: aba.sheetId, dimension: 'COLUMNS', length: necessario - aba.columnCount },
    }]);
    aba.columnCount = necessario;
  }
  const inicio = letraColuna(totalAtual);
  const fim = letraColuna(necessario - 1);
  await escreverCelulas(token, [{ range: formatarRangeSheet(aba.title, `${inicio}1:${fim}1`), values: [novas] }]);
}

/** Linhas de dados com o número real da linha na planilha (cabeçalho = linha 1). */
function linhasComNumero(tabela: string, valores: unknown[][]): { numero: number; objeto: Record<string, any> }[] {
  const cabecalho = valores[0] || [];
  return valores.slice(1).flatMap((linha, i) => {
    const [objeto] = normalizarLinhasDaAba(tabela, parseSheetRowsToObjects([cabecalho, linha]));
    return objeto ? [{ numero: i + 2, objeto }] : [];
  });
}

function identidadeSegura(tabela: string, registro: Record<string, any>): string | null {
  try { return recordIdentity(tabela, registro); } catch { return null; }
}

// ---------------------------------------------------------------------------
// LEITURA
// ---------------------------------------------------------------------------

/** Abas preenchidas à mão (nomes, códigos): leitura também do texto exibido. */
const ABAS_DE_CADASTRO = ['periodos', 'disciplinas', 'turmas', 'turmas_origem', 'alunos', 'matriculas', 'criterios_avaliacao', 'grupos_pratica', 'configuracoes'];

/**
 * Lê várias abas numa requisição; se o lote falhar, lê aba por aba
 * (uma aba com problema não impede as demais). Posição sem resposta = null.
 */
async function lerEmLote(token: string, titulos: string[], parametros: string): Promise<(unknown[][] | null)[]> {
  const ranges = titulos.map(t => `ranges=${encodeURIComponent(formatarRangeSheet(t, 'A1:ZZ'))}`).join('&');
  const res = await fetchWithTimeout(`${API}/values:batchGet?${ranges}&${parametros}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.ok) {
    const valueRanges: { values?: unknown[][] }[] = (await res.json()).valueRanges || [];
    return titulos.map((_, i) => (valueRanges[i] ? valueRanges[i].values || [] : null));
  }
  if (res.status === 401) await falhaHttp(res, 'Leitura da planilha');
  return Promise.all(titulos.map(async t => {
    try {
      const range = encodeURIComponent(formatarRangeSheet(t, 'A1:ZZ'));
      const r = await fetchWithTimeout(`${API}/values/${range}?${parametros}`, { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? ((await r.json()).values || []) : null;
    } catch (erro) {
      console.warn(`Erro ao ler aba ${t}:`, erro);
      return null;
    }
  }));
}

/**
 * Combina valor bruto e texto exibido: número que é de fato número fica bruto (sem vírgula de milhar);
 * número que a planilha criou a partir de um texto (ex.: "2026.2" → data) volta a ser o texto exibido.
 * Colunas de data/hora continuam brutas para a conversão segura.
 */
function combinarValores(brutos: unknown[][], exibidos: unknown[][]): unknown[][] {
  const cabecalho = (brutos[0] || []).map(h => String(h ?? '').toLowerCase());
  return brutos.map((linha, i) => i === 0 ? linha : linha.map((valor, c) => {
    if (typeof valor !== 'number' || /^(data|prazo|hora)|_em$/.test(cabecalho[c] || '')) return valor;
    const texto = exibidos[i]?.[c];
    if (typeof texto !== 'string' || texto === '') return valor;
    return Number(texto.replace(/\./g, '').replace(',', '.')) === valor || Number(texto.replace(',', '.')) === valor ? valor : texto;
  }));
}

export interface LeituraPlanilha {
  /** Aba canônica → linhas normalizadas. Ausente = não foi possível ler. */
  tabelas: Record<string, any[]>;
  /** Abas que não existem na planilha. */
  ausentes: string[];
}

export async function carregarDadosDaPlanilhaOficial(): Promise<LeituraPlanilha> {
  const token = await getAccessToken();
  if (!token) throw new Error('Usuário não autenticado no Google para acessar a planilha.');

  const abas = await obterAbas(token, true);
  const encontradas: { tabela: TabelaBase; titulo: string }[] = [];
  const ausentes: string[] = [];
  for (const tabela of TABELAS_LIDAS) {
    const aba = encontrarAba(abas, tabela);
    if (aba) encontradas.push({ tabela, titulo: aba.title });
    else ausentes.push(tabela);
  }

  const tabelas: Record<string, any[]> = {};
  const montar = (tabela: string, valores: unknown[][]) =>
    normalizarLinhasDaAba(tabela, parseSheetRowsToObjects(valores));

  if (encontradas.length > 0) {
    const brutas = await lerEmLote(token, encontradas.map(e => e.titulo), LEITURA_BRUTA);
    // Abas de cadastro também são lidas como aparecem na tela: textos digitados que a planilha
    // converteu sozinha (ex.: "2026.2" virou data) voltam a ser o texto exibido.
    const cadastro = encontradas.filter(e => ABAS_DE_CADASTRO.includes(e.tabela));
    const exibidas = cadastro.length ? await lerEmLote(token, cadastro.map(e => e.titulo), 'valueRenderOption=FORMATTED_VALUE').catch(() => null) : null;
    encontradas.forEach((e, i) => {
      const valores = brutas[i];
      if (!valores) return; // falha de leitura não é tabela vazia
      const idxCadastro = cadastro.indexOf(e);
      const exibido = idxCadastro >= 0 && exibidas ? exibidas[idxCadastro] : null;
      tabelas[e.tabela] = montar(e.tabela, exibido ? combinarValores(valores, exibido) : valores);
    });
  }
  return { tabelas, ausentes };
}

// ---------------------------------------------------------------------------
// GRAVAÇÃO
// ---------------------------------------------------------------------------

export interface ItemDeGravacao {
  registro: Record<string, any>;
  /** Campos a gravar numa atualização. Sem lista, grava apenas o que mudou. */
  campos?: string[];
}

/**
 * Grava vários registros da mesma aba com 1 leitura + até 2 requisições
 * (antes: 1 leitura e 1 gravação por registro).
 * Registro existente (pela chave) → atualiza só células alteradas. Novo → acrescenta linha.
 */
export async function gravarLoteNaPlanilhaOficial(tabela: string, itens: ItemDeGravacao[]): Promise<void> {
  if (itens.length === 0) return;
  const token = await exigirToken();
  const t = tabela as TabelaBase;
  if (!TABELAS_GRAVAVEIS.includes(t)) throw new Error(`A aba ${tabela} é somente leitura no app.`);

  let aba = encontrarAba(await obterAbas(token), tabela);
  if (!aba) {
    const colunas = COLUNAS_DAS_ABAS_DO_APP[t];
    if (!colunas) throw new Error(`Tabela ${tabela} não existe na base oficial.`);
    aba = await criarAba(token, tabela, colunas);
  }

  const valores = await lerValores(token, aba.title);
  let headers = (valores[0] || []).map(h => String(h ?? '').trim());
  if (!headers.some(Boolean)) {
    const colunas = COLUNAS_DAS_ABAS_DO_APP[t];
    if (!colunas) throw new Error(`Aba ${aba.title} não possui cabeçalho válido.`);
    await escreverCelulas(token, [{ range: formatarRangeSheet(aba.title, 'A1'), values: [colunas] }]);
    headers = [...colunas];
  }
  const pk = CHAVE_PRIMARIA[t] || '';
  if (!headers.map(h => h.toLowerCase()).includes(pk)) {
    throw new Error(`Registro incompatível: cabeçalho ${pk} ausente.`);
  }

  const editaveis = CAMPOS_EDITAVEIS[t];
  const preparados = itens.map(({ registro, campos }) => {
    const adaptado = adaptarParaPlanilha(tabela, registro);
    const identidade = recordIdentity(tabela, { ...registro, ...adaptado });
    let alvo = campos ? campos.flatMap(c => Object.keys(adaptarParaPlanilha(tabela, { [c]: registro[c] }))) : null;
    if (editaveis) alvo = (alvo ?? Object.keys(adaptado)).filter(c => editaveis.includes(c));
    return { adaptado, identidade, alvo };
  });

  // Colunas novas que o app precisa (ex.: atraso/celular em frequencias) entram no fim.
  const extras = COLUNAS_EXTRAS_PERMITIDAS[t] || [];
  const minusculas = () => headers.map(h => h.toLowerCase());
  const faltantes = [...new Set(preparados.flatMap(p => p.alvo ?? Object.keys(p.adaptado)))]
    .filter(c => extras.includes(c) && !minusculas().includes(c.toLowerCase()));
  if (faltantes.length > 0) {
    await acrescentarColunas(token, aba, headers.length, faltantes);
    headers = [...headers, ...faltantes];
  }

  const existentes = linhasComNumero(tabela, valores);
  const porIdentidade = new Map<string, { numero: number; objeto: Record<string, any> }[]>();
  for (const linha of existentes) {
    const id = identidadeSegura(tabela, linha.objeto);
    if (id) porIdentidade.set(id, [...(porIdentidade.get(id) || []), linha]);
  }

  const celulas: { range: string; values: string[][] }[] = [];
  const novasLinhas: string[][] = [];
  const valorDe = (obj: Record<string, any>, h: string) => (h in obj ? obj[h] : obj[h.toLowerCase()]);

  for (const p of preparados) {
    const achados = porIdentidade.get(p.identidade) || [];
    if (achados.length > 1) throw new Error(`Escrita bloqueada: chave duplicada na planilha (${tabela}).`);
    if (achados.length === 1) {
      const { numero, objeto } = achados[0];
      const permitidos = new Set((p.alvo ?? Object.keys(p.adaptado)).map(c => c.toLowerCase()));
      headers.forEach((h, col) => {
        const hl = h.toLowerCase();
        if (!h || hl === pk || !permitidos.has(hl)) return;
        const novo = valorDe(p.adaptado, h);
        if (novo === undefined) return;
        if (serializarValor(novo) === serializarValor(objeto[h])) return;
        celulas.push({ range: formatarRangeSheet(aba!.title, `${letraColuna(col)}${numero}`), values: [[serializarValor(novo)]] });
      });
      continue;
    }
    if (TABELAS_SOMENTE_ATUALIZACAO.includes(t)) {
      throw new Error(`Registro não encontrado em ${tabela}; o app não cria linhas nessa aba.`);
    }
    if (!headers.some(h => h.toLowerCase() !== pk && valorDe(p.adaptado, h) !== undefined)) {
      throw new Error(`Registro incompatível com cabeçalhos da tabela ${tabela}; escrita bloqueada.`);
    }
    novasLinhas.push(headers.map(h => (h ? serializarValor(valorDe(p.adaptado, h)) : '')));
    porIdentidade.set(p.identidade, [{ numero: -1, objeto: p.adaptado }]);
  }

  await escreverCelulas(token, celulas);
  if (novasLinhas.length > 0) {
    const range = encodeURIComponent(formatarRangeSheet(aba.title, 'A1:ZZ'));
    const res = await fetchWithTimeout(`${API}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: novasLinhas }),
    });
    if (!res.ok) await falhaHttp(res, `Falha ao gravar na tabela ${aba.title}`);
  }
}

export async function gravarRegistroNaPlanilhaOficial(
  tabela: string,
  registro: Record<string, any>,
  campos?: string[]
): Promise<boolean> {
  await gravarLoteNaPlanilhaOficial(tabela, [{ registro, campos }]);
  return true;
}

/**
 * Exclui uma linha somente quando a chave a identifica inequivocamente.
 * Se a linha já não existe (resposta perdida numa tentativa anterior), considera concluído.
 */
export async function removerRegistroDaPlanilhaOficial(tabela: string, registro: Record<string, any>): Promise<boolean> {
  const token = await exigirToken();
  if (!TABELAS_GRAVAVEIS.includes(tabela as TabelaBase)) throw new Error(`A aba ${tabela} é somente leitura no app.`);
  const aba = encontrarAba(await obterAbas(token), tabela);
  if (!aba) throw new Error(`Aba ${tabela} não localizada; exclusão cancelada.`);
  const pk = CHAVE_PRIMARIA[tabela as TabelaBase] || '';
  const valores = await lerValores(token, aba.title);
  const headers = (valores[0] || []).map(h => String(h ?? '').trim());
  if (!pk || !headers.includes(pk)) throw new Error(`Chave primária inválida para excluir em ${tabela}.`);
  const identidade = recordIdentity(tabela, adaptarParaPlanilha(tabela, registro));
  const linhas = linhasComNumero(tabela, valores).filter(l => identidadeSegura(tabela, l.objeto) === identidade);
  if (linhas.length === 0) return true;
  if (linhas.length !== 1) throw new Error('Exclusão bloqueada: chave ausente ou duplicada.');
  const indice = linhas[0].numero - 1;
  await estruturaPlanilha(token, [{
    deleteDimension: { range: { sheetId: aba.sheetId, dimension: 'ROWS', startIndex: indice, endIndex: indice + 1 } },
  }]);
  return true;
}
