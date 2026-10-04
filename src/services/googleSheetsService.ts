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

// Gerenciamento persistente de token OAuth
const TOKEN_KEY = 'cs_google_access_token_v2';
const TOKEN_TIME_KEY = 'cs_google_access_token_time_v2';
const TOKEN_MAX_AGE_MS = 55 * 60 * 1000; // 55 minutos para renovação segura

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  const timeStr = localStorage.getItem(TOKEN_TIME_KEY);
  if (!token) return null;
  if (timeStr) {
    const age = Date.now() - Number(timeStr);
    if (age > TOKEN_MAX_AGE_MS) {
      // Token expirado
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_TIME_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
  }
  return token;
}

export function setStoredAccessToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_TIME_KEY, String(Date.now()));
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_TIME_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

let isSigningIn = false;
let cachedAccessToken: string | null = getStoredAccessToken();

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    const token = await getAccessToken();
    if (user && token) {
      cachedAccessToken = token;
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
    cachedAccessToken = credential.accessToken;
    setStoredAccessToken(cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Erro de autenticação Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) {
    const stored = getStoredAccessToken();
    if (stored) return stored;
  }
  const stored = getStoredAccessToken();
  if (stored) {
    cachedAccessToken = stored;
    return stored;
  }
  return null;
};

export const googleLogout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  setStoredAccessToken(null);
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
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${OFFICIAL_SPREADSHEET_ID}?fields=sheets.properties.title`;
  const metaRes = await fetch(metaUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!metaRes.ok) {
    if (metaRes.status === 401) {
      setStoredAccessToken(null);
      cachedAccessToken = null;
      throw new Error('Sessão expirada do Google. É necessário autenticar novamente.');
    }
    const errJson = await metaRes.json().catch(() => null);
    throw new Error(errJson?.error?.message || `Erro ${metaRes.status} ao acessar metadados da planilha oficial.`);
  }

  const metaData = await metaRes.json();
  const sheets: Array<{ properties?: { title?: string } }> = metaData.sheets || [];
  const existingTitles = sheets.map(s => s.properties?.title || '').filter(Boolean);

  // Mapeia tabelas normalizadas com os títulos reais das abas
  const matchedTables: { canonicalName: string; realSheetName: string }[] = [];
  const missingSheets: string[] = [];

  TABELAS_NORMALIZADAS.forEach(targetTab => {
    const match = existingTitles.find(
      t => t.trim().toLowerCase() === targetTab.trim().toLowerCase()
    );
    if (match) {
      matchedTables.push({ canonicalName: targetTab, realSheetName: match });
    } else {
      missingSheets.push(targetTab);
    }
  });

  const tableDataMap: Record<string, any[]> = {};

  if (matchedTables.length > 0) {
    const rangesQuery = matchedTables
      .map(m => `ranges=${encodeURIComponent(`${m.realSheetName}!A1:ZZ`)}`)
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
            const singleUrl = `https://sheets.googleapis.com/v4/spreadsheets/${OFFICIAL_SPREADSHEET_ID}/values/${encodeURIComponent(m.realSheetName)}!A1:ZZ`;
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
 */
export async function gravarRegistroNaPlanilhaOficial(
  tabela: string,
  registro: Record<string, any>
): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com Google Workspace.');

  // 1. Obtém o cabeçalho existente da tabela
  const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${OFFICIAL_SPREADSHEET_ID}/values/${encodeURIComponent(tabela)}!1:1`;
  const headerRes = await fetch(headerUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!headerRes.ok) {
    throw new Error(`Falha ao ler cabeçalhos da tabela ${tabela} no Google Sheets.`);
  }

  const headerData = await headerRes.json();
  const headers: string[] = headerData.values?.[0] || Object.keys(registro);

  // 2. Monta a linha conforme a ordem exata dos cabeçalhos reais
  const rowValues = headers.map(h => {
    const cleanHeader = h.trim();
    const lowerHeader = cleanHeader.toLowerCase();
    const val = registro[cleanHeader] !== undefined ? registro[cleanHeader] : registro[lowerHeader];
    if (val === undefined || val === null) return '';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    return String(val);
  });

  // 3. Executa o append seguro
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${OFFICIAL_SPREADSHEET_ID}/values/${encodeURIComponent(tabela)}!A1:append?valueInputOption=USER_ENTERED`;
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
    const err = await appendRes.json().catch(() => null);
    throw new Error(err?.error?.message || `Falha ao gravar na tabela ${tabela}`);
  }

  return true;
}
