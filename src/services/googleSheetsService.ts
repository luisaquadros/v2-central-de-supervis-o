import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { DadosIniciaisGas } from './gasService';

export const OFFICIAL_SPREADSHEET_ID = '1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4';
export const OFFICIAL_SPREADSHEET_NAME = 'Central de Supervisão - DESENVOLVIMENTO';
export const OFFICIAL_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${OFFICIAL_SPREADSHEET_ID}`;

// 34 Tabelas Normalizadas e de Governança que o sistema consome da base oficial
export const TABELAS_NORMALIZADAS = [
  // 18 Tabelas Base
  'periodos',
  'disciplinas',
  'turmas',
  'horarios_turma',
  'turmas_origem',
  'alunos',
  'matriculas',
  'orientacoes',
  'criterios_avaliacao',
  'configuracoes',
  'marcos_academicos',
  'pontos_acompanhamento',
  'frequencias',
  'documentos',
  'registros_semanais',
  'avaliacoes',
  'feedback_alunos',
  'ocorrencias',
  // 12 Tabelas Adicionais Normalizadas
  'regras_rss',
  'calendario_rss',
  'status_rss_unidades',
  'situacao_atual_turmas',
  'leituras_responsaveis',
  'regras_prazo',
  'grupos_pratica',
  'grupo_integrantes',
  'entregas',
  'feedbacks',
  'registros_supervisao',
  'sincronizacao',
  // Documentação e Contrato da Base Oficial
  'dicionario_dados',
  'contrato_app',
  'mapeamento_fontes',
  'auditoria_base',
] as const;

// Inicialização segura do Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

// Persistência segura da sessão e token de acesso OAuth no sessionStorage (com expiração de 55 minutos)
const SESSION_TOKEN_KEY = 'cs_google_access_token_session';
const SESSION_EXPIRY_KEY = 'cs_google_access_token_exp';

function saveTokenToSession(token: string) {
  try {
    if (typeof window !== 'undefined') {
      const expiresAt = Date.now() + 55 * 60 * 1000; // 55 minutos
      try {
        sessionStorage.setItem(SESSION_TOKEN_KEY, token);
        sessionStorage.setItem(SESSION_EXPIRY_KEY, String(expiresAt));
      } catch {}
      try {
        localStorage.setItem(SESSION_TOKEN_KEY, token);
        localStorage.setItem(SESSION_EXPIRY_KEY, String(expiresAt));
      } catch {}
    }
  } catch (e) {
    // ignore
  }
}

function getStoredTokenFromSession(): string | null {
  try {
    if (typeof window !== 'undefined') {
      let token: string | null = null;
      let expStr: string | null = null;
      try {
        token = sessionStorage.getItem(SESSION_TOKEN_KEY);
        expStr = sessionStorage.getItem(SESSION_EXPIRY_KEY);
      } catch {}
      if (!token) {
        try {
          token = localStorage.getItem(SESSION_TOKEN_KEY);
          expStr = localStorage.getItem(SESSION_EXPIRY_KEY);
        } catch {}
      }
      if (token && expStr) {
        const exp = Number(expStr);
        if (Date.now() < exp) {
          return token;
        } else {
          clearSessionToken();
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function clearSessionToken() {
  try {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
        sessionStorage.removeItem(SESSION_EXPIRY_KEY);
      } catch {}
      try {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(SESSION_EXPIRY_KEY);
      } catch {}
    }
  } catch (e) {
    // ignore
  }
}

let inMemoryAccessToken: string | null = getStoredTokenFromSession();
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = inMemoryAccessToken || getStoredTokenFromSession();
      if (token) {
        inMemoryAccessToken = token;
      }
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso do Google.');
    }
    inMemoryAccessToken = credential.accessToken;
    saveTokenToSession(credential.accessToken);
    return { user: result.user, accessToken: inMemoryAccessToken };
  } catch (error: any) {
    console.error('Erro de autenticação Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  const stored = getStoredTokenFromSession();
  if (stored) {
    inMemoryAccessToken = stored;
    return stored;
  }
  return null;
};

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
  inMemoryAccessToken = null;
  clearSessionToken();
};

/**
 * Converte matriz de linhas de uma aba em lista de objetos, usando cabeçalhos reais da planilha
 */
function parseSheetRowsToObjects<T>(rows: any[][]): T[] {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(h => String(h || '').trim());
  const dataRows = rows.slice(1);

  return dataRows.map(row => {
    const obj: any = {};
    headers.forEach((h, idx) => {
      const cleanHeader = h.trim();
      const lowerHeader = cleanHeader.toLowerCase();
      let val = row[idx];
      if (val === undefined || val === null) {
        val = '';
      } else if (typeof val === 'string') {
        val = val.trim();
        if (val.toUpperCase() === 'TRUE' || val.toUpperCase() === 'VERDADEIRO') val = true;
        else if (val.toUpperCase() === 'FALSE' || val.toUpperCase() === 'FALSO') val = false;
      }
      obj[cleanHeader] = val;
      // Garante acesso por chave em minúsculas
      if (lowerHeader !== cleanHeader && !obj[lowerHeader]) {
        obj[lowerHeader] = val;
      }
    });
    return obj as T;
  });
}

// Cache em memória dos títulos reais das abas existentes na planilha oficial
let cachedRealSheetTitles: string[] | null = null;
let lastTitlesFetchTime = 0;

export function normalizarChaveAba(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s\-_]+/g, '_');
}

export async function obterTitulosReaisDasAbas(token: string, forceRefresh = false): Promise<string[]> {
  const now = Date.now();
  if (!forceRefresh && cachedRealSheetTitles && cachedRealSheetTitles.length > 0 && now - lastTitlesFetchTime < 300000) {
    return cachedRealSheetTitles;
  }
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${OFFICIAL_SPREADSHEET_ID}?fields=sheets.properties.title`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) {
    if (metaRes.status === 401) {
      clearAccessToken();
      throw new Error('Sessão expirada do Google. É necessário autenticar novamente.');
    }
    return cachedRealSheetTitles || [];
  }
  const metaData = await metaRes.json();
  const sheets: Array<{ properties?: { title?: string } }> = metaData.sheets || [];
  cachedRealSheetTitles = sheets.map(s => s.properties?.title || '').filter(Boolean);
  lastTitlesFetchTime = now;
  return cachedRealSheetTitles;
}

export async function resolverNomeRealAba(token: string, tabelaCanonica: string): Promise<string> {
  const titles = await obterTitulosReaisDasAbas(token);
  if (!titles || titles.length === 0) return tabelaCanonica;

  const targetNorm = normalizarChaveAba(tabelaCanonica);

  // 1. Match exato
  const exact = titles.find(t => t === tabelaCanonica);
  if (exact) return exact;

  // 2. Match normalizado (sem acentos e símbolos)
  const normMatch = titles.find(t => normalizarChaveAba(t) === targetNorm);
  if (normMatch) return normMatch;

  // 3. Match sem conectivos ('de', 'da', 'do')
  const targetSemConectivo = targetNorm.replace(/_(de|da|do)_/g, '_');
  const flexMatch = titles.find(t => {
    const tNorm = normalizarChaveAba(t).replace(/_(de|da|do)_/g, '_');
    return tNorm === targetSemConectivo;
  });
  if (flexMatch) return flexMatch;

  return tabelaCanonica;
}

export function formatarRangeSheet(nomeRealAba: string, range?: string): string {
  const quoted = `'${nomeRealAba.replace(/'/g, "''")}'`;
  return range ? `${quoted}!${range}` : quoted;
}

export interface ResultadoLeituraPlanilha extends DadosIniciaisGas {
  _rawMap: Record<string, any[]>;
  _missingSheets: string[];
}

/**
 * Carrega as tabelas normalizadas diretamente da API Google Sheets v4 com resiliência:
 * 1. Verifica quais abas existem realmente na planilha (evita HTTP 400)
 * 2. Faz batchGet somente das abas existentes
 * 3. Faz fallback individual para abas se necessário
 */
export async function carregarDadosDaPlanilhaOficial(): Promise<ResultadoLeituraPlanilha> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Usuário não autenticado no Google para acessar a planilha.');
  }

  // 1. Obtém metadados da planilha para saber quais abas existem
  const existingTitles = await obterTitulosReaisDasAbas(token, true);

  // Mapeia tabelas normalizadas com os títulos reais das abas
  const matchedTables: { canonicalName: string; realSheetName: string }[] = [];
  const missingSheets: string[] = [];

  TABELAS_NORMALIZADAS.forEach(targetTab => {
    const targetNorm = normalizarChaveAba(targetTab);
    const targetSemConectivo = targetNorm.replace(/_(de|da|do)_/g, '_');

    const match = existingTitles.find(t => {
      if (t === targetTab) return true;
      const tNorm = normalizarChaveAba(t);
      if (tNorm === targetNorm) return true;
      const tNormSemConectivo = tNorm.replace(/_(de|da|do)_/g, '_');
      return tNormSemConectivo === targetSemConectivo;
    });

    if (match) {
      matchedTables.push({ canonicalName: targetTab, realSheetName: match });
    } else {
      missingSheets.push(targetTab);
    }
  });

  const tableDataMap: Record<string, any[]> = {};

  if (matchedTables.length > 0) {
    const rangesQuery = matchedTables
      .map(m => `ranges=${encodeURIComponent(formatarRangeSheet(m.realSheetName, 'A1:ZZ'))}`)
      .join('&');
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${OFFICIAL_SPREADSHEET_ID}/values:batchGet?${rangesQuery}`;

    const batchRes = await fetch(batchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (batchRes.ok) {
      const batchData = await batchRes.json();
      const valueRanges: { range: string; values?: any[][] }[] = batchData.valueRanges || [];
      matchedTables.forEach((m, idx) => {
        const vr = valueRanges[idx];
        const rows = vr?.values || [];
        tableDataMap[m.canonicalName] = parseSheetRowsToObjects(rows);
      });
    } else {
      // Fallback resiliente: lê individualmente cada aba que existe
      console.warn('BatchGet falhou, tentando leitura resiliente individual...');
      await Promise.all(
        matchedTables.map(async m => {
          try {
            const singleUrl = `https://sheets.googleapis.com/v4/spreadsheets/${OFFICIAL_SPREADSHEET_ID}/values/${encodeURIComponent(formatarRangeSheet(m.realSheetName, 'A1:ZZ'))}`;
            const singleRes = await fetch(singleUrl, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (singleRes.ok) {
              const singleData = await singleRes.json();
              tableDataMap[m.canonicalName] = parseSheetRowsToObjects(singleData.values || []);
            }
          } catch (e) {
            console.warn(`Erro ao ler aba ${m.realSheetName}:`, e);
          }
        })
      );
    }
  }

  return {
    periodos: tableDataMap['periodos'] || [],
    disciplinas: tableDataMap['disciplinas'] || [],
    turmas: tableDataMap['turmas'] || [],
    horarios: tableDataMap['horarios_turma'] || [],
    turmasOrigem: tableDataMap['turmas_origem'] || [],
    alunos: tableDataMap['alunos'] || [],
    matriculas: tableDataMap['matriculas'] || [],
    criterios: tableDataMap['criterios_avaliacao'] || [],
    orientacoes: tableDataMap['orientacoes'] || [],
    configuracoes: tableDataMap['configuracoes'] || [],
    marcos: tableDataMap['marcos_academicos'] || [],
    pontosAcompanhamento: tableDataMap['pontos_acompanhamento'] || [],
    frequencias: tableDataMap['frequencias'] || [],
    documentos: tableDataMap['documentos'] || [],
    registrosSemanais: tableDataMap['registros_semanais'] || [],
    avaliacoes: tableDataMap['avaliacoes'] || [],
    feedbacks: tableDataMap['feedback_alunos'] || [],
    ocorrencias: tableDataMap['ocorrencias'] || [],
    regrasRss: tableDataMap['regras_rss'] || [],
    calendarioRss: tableDataMap['calendario_rss'] || [],
    statusRssUnidades: tableDataMap['status_rss_unidades'] || [],
    situacaoAtualTurmas: tableDataMap['situacao_atual_turmas'] || [],
    leiturasResponsaveis: tableDataMap['leituras_responsaveis'] || [],
    regrasPrazo: tableDataMap['regras_prazo'] || [],
    gruposPratica: tableDataMap['grupos_pratica'] || [],
    grupoIntegrantes: tableDataMap['grupo_integrantes'] || [],
    entregas: tableDataMap['entregas'] || [],
    feedbacksOficiais: tableDataMap['feedbacks'] || [],
    registrosSupervisao: tableDataMap['registros_supervisao'] || [],
    sincronizacao: tableDataMap['sincronizacao'] || [],
    dicionarioDados: tableDataMap['dicionario_dados'] || [],
    contratoApp: tableDataMap['contrato_app'] || [],
    mapeamentoFontes: tableDataMap['mapeamento_fontes'] || [],
    auditoriaBase: tableDataMap['auditoria_base'] || [],
    _rawMap: tableDataMap,
    _missingSheets: missingSheets,
  };
}

/**
 * Grava uma nova linha diretamente na tabela da planilha oficial via Google Sheets API v4
 * Com prevenção estrita contra duplicações: se a linha já existir pelo identificador único,
 * atualiza a linha correspondente em vez de duplicar.
 */
export async function gravarRegistroNaPlanilhaOficial(
  tabela: string,
  registro: Record<string, any>
): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com Google Workspace.');

  // Obtém o nome real exato da aba na planilha (com acentos e formatação correta)
  const realSheetName = await resolverNomeRealAba(token, tabela);

  // 1. Obtém o cabeçalho e dados existentes da tabela para verificação de duplicidade
  const tableDataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${OFFICIAL_SPREADSHEET_ID}/values/${encodeURIComponent(formatarRangeSheet(realSheetName, 'A1:ZZ'))}`;
  const tableDataRes = await fetch(tableDataUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!tableDataRes.ok) {
    if (tableDataRes.status === 401) {
      clearAccessToken();
      throw new Error('Sessão expirada do Google. É necessário autenticar novamente.');
    }
    throw new Error(`Falha ao ler dados da tabela ${realSheetName} no Google Sheets.`);
  }

  const tableDataJson = await tableDataRes.json();
  const allRows: any[][] = tableDataJson.values || [];
  const headers: string[] = allRows[0] || Object.keys(registro);

  // 2. Monta a linha conforme a ordem exata dos cabeçalhos reais
  const rowValues = headers.map(h => {
    const cleanHeader = h.trim();
    const lowerHeader = cleanHeader.toLowerCase();
    const val = registro[cleanHeader] !== undefined ? registro[cleanHeader] : registro[lowerHeader];
    if (val === undefined || val === null) return '';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    return String(val);
  });

  // 3. Procura por linha existente com a mesma chave primária / chave composta
  let existingRowIndex = -1; // 1-indexed

  if (allRows.length > 1) {
    const lowerHeaders = headers.map(h => h.trim().toLowerCase());

    if (tabela === 'frequencias') {
      const matIdx = lowerHeaders.indexOf('matricula_id');
      const dataIdx = lowerHeaders.indexOf('data_aula');
      if (matIdx >= 0 && dataIdx >= 0) {
        for (let i = 1; i < allRows.length; i++) {
          const row = allRows[i];
          if (
            String(row[matIdx] || '').trim() === String(registro.matricula_id || '').trim() &&
            String(row[dataIdx] || '').trim() === String(registro.data_aula || '').trim()
          ) {
            existingRowIndex = i + 1; // 1-indexed
            break;
          }
        }
      }
    } else {
      // Procura por coluna de ID
      const primaryKeyCol =
        lowerHeaders.find(h => h === `${tabela.toLowerCase()}_id`) ||
        lowerHeaders.find(h => h === 'id') ||
        lowerHeaders.find(h => h.endsWith('_id'));

      if (primaryKeyCol) {
        const keyIdx = lowerHeaders.indexOf(primaryKeyCol);
        const recordKeyVal = String(
          registro[primaryKeyCol] ||
          registro[primaryKeyCol.toUpperCase()] ||
          registro.id ||
          ''
        ).trim();

        if (recordKeyVal) {
          for (let i = 1; i < allRows.length; i++) {
            const row = allRows[i];
            if (String(row[keyIdx] || '').trim() === recordKeyVal) {
              existingRowIndex = i + 1;
              break;
            }
          }
        }
      }
    }
  }

  // 4. Se a linha já existe, executa UPDATE (PUT) evitando duplicação
  if (existingRowIndex > 0) {
    const updateRange = formatarRangeSheet(realSheetName, `A${existingRowIndex}`);
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${OFFICIAL_SPREADSHEET_ID}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`;
    const updateRes = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    });

    if (!updateRes.ok) {
      if (updateRes.status === 401) {
        clearAccessToken();
        throw new Error('Sessão expirada do Google. É necessário autenticar novamente.');
      }
      const err = await updateRes.json().catch(() => null);
      throw new Error(err?.error?.message || `Falha ao atualizar registro existente na tabela ${realSheetName}`);
    }

    return true;
  }

  // 5. Caso não exista, executa o APPEND seguro
  const appendRange = formatarRangeSheet(realSheetName, 'A1:append');
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${OFFICIAL_SPREADSHEET_ID}/values/${encodeURIComponent(appendRange)}?valueInputOption=USER_ENTERED`;
  const appendRes = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowValues],
    }),
  });

  if (!appendRes.ok) {
    if (appendRes.status === 401) {
      clearAccessToken();
      throw new Error('Sessão expirada do Google. É necessário autenticar novamente.');
    }
    const err = await appendRes.json().catch(() => null);
    throw new Error(err?.error?.message || `Falha ao gravar na tabela ${realSheetName}`);
  }

  return true;
}
