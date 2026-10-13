/**
 * Testes sem rede da API Google Sheets.
 * Nenhum dado real, token real ou planilha da instituição é alterado.
 */
import { strict as assert } from 'node:assert';
import {
  setMockToken,
  clearAccessToken,
  gravarRegistroNaPlanilhaOficial,
  removerRegistroDaPlanilhaOficial,
} from '../services/googleSheetsService';

const originalFetch = globalThis.fetch;
let calls: { url: string; init: RequestInit; body: any }[] = [];
let sheetRows: any[][] = [];
const jsonOk = (data: any) => ({ ok: true, status: 200, json: async () => data }) as Response;

const SHEETS: Record<string, number> = {
  orientacoes: 11,
  entregas: 12,
  frequencias: 13,
};

globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url);
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url: u, init: init || {}, body });
  if (u.includes('fields=sheets.properties.title')) {
    return jsonOk({ sheets: Object.keys(SHEETS).map(title => ({ properties: { title } })) });
  }
  if (u.includes('fields=sheets.properties(sheetId,title)')) {
    return jsonOk({ sheets: Object.entries(SHEETS).map(([title, sheetId]) => ({ properties: { title, sheetId } })) });
  }
  if (u.includes('/values/') && (!init?.method || init.method === 'GET')) return jsonOk({ values: sheetRows });
  if (u.includes(':batchUpdate') || u.includes('/values/')) return jsonOk({ updatedRows: 1 });
  throw new Error('Unexpected URL in test: ' + u);
}) as typeof fetch;

const requiredWrite = (method: string) => {
  const c = calls.findLast(x => x.init.method === method);
  assert(c, 'expected write ' + method);
  assert(!c.url.includes('A1%3Aappend') && !c.url.includes('A1:append'), 'range A1:append is invalid');
  return c;
};
try {
  setMockToken('token-ficticio-testes');

  // 1. INSERT não deve interpretar textos com "=" como fórmulas.
  calls = [];
  sheetRows = [['orientacao_id', 'matricula_id', 'data_hora', 'categoria', 'texto', 'status']];
  await gravarRegistroNaPlanilhaOficial('orientacoes', {
    orientacao_id: 'ori-1', matricula_id: 'mat-1', data_hora: '2026-10-13',
    categoria: 'Clínica', texto: '=2+2', status: 'ABERTA',
  });
  const create = requiredWrite('POST');
  assert(create.url.includes('valueInputOption=RAW'), 'RAW must be used for untrusted text');
  assert.equal(create.body.values[0][4], '=2+2');

  // 2. UPDATE parcial preserva colunas existentes não informadas no payload.
  calls = [];
  sheetRows = [
    ['orientacao_id', 'matricula_id', 'data_hora', 'categoria', 'texto', 'status'],
    ['ori-1', 'mat-1', '2026-10-13', 'Clínica', 'Orientação preservada', 'ABERTA'],
  ];
  await gravarRegistroNaPlanilhaOficial('orientacoes', { orientacao_id: 'ori-1', status: 'CONCLUÍDA' });
  const update = requiredWrite('PUT');
  assert.equal(update.body.values[0][4], 'Orientação preservada');
  assert.equal(update.body.values[0][5], 'CONCLUÍDA');

  // 3. Campos da aba entregas devem respeitar o schema oficial.
  calls = [];
  sheetRows = [['entrega_id', 'periodo_id', 'turma_id', 'matricula_id', 'tipo_entrega', 'data_envio', 'status']];
  await gravarRegistroNaPlanilhaOficial('entregas', {
    entrega_id: 'e-1', periodo_id: 'p-1', turma_id: 't-1', matricula_id: 'm-1',
    tipo_documento: 'RELATORIO', data_entrega: '2026-10-13', status_entrega: 'ENTREGUE',
  });
  const entrega = requiredWrite('POST');
  assert.equal(entrega.body.values[0][4], 'RELATORIO');
  assert.equal(entrega.body.values[0][5], '2026-10-13');
  assert.equal(entrega.body.values[0][6], 'ENTREGUE');

  // 4. Chamada é idempotente por matrícula/data e não duplica quando já existe.
  calls = [];
  sheetRows = [
    ['frequencia_id', 'matricula_id', 'data_aula', 'status', 'justificativa'],
    ['f-1', 'm-1', '2026-10-13', 'PRESENTE', ''],
  ];
  await gravarRegistroNaPlanilhaOficial('frequencias', {
    frequencia_id: 'f-2', matricula_id: 'm-1', data_aula: '2026-10-13',
    status: 'FALTA_JUSTIFICADA', justificativa: 'Atestado conferido',
  });
  assert(requiredWrite('PUT').body.values[0][3] === 'FALTA_JUSTIFICADA');
  assert(!calls.some(c => c.init.method === 'POST'), 'Must not append duplicate attendance');

  // 5. DELETE deve excluir apenas uma linha identificada inequivocamente.
  calls = [];
  sheetRows = [['orientacao_id', 'matricula_id'], ['ori-1', 'm-1']];
  await removerRegistroDaPlanilhaOficial('orientacoes', { orientacao_id: 'ori-1' });
  assert.equal(requiredWrite('POST').body.requests[0].deleteDimension.range.startIndex, 1);

  calls = [];
  sheetRows = [['orientacao_id', 'matricula_id'], ['ori-1', 'm-1'], ['ori-1', 'm-2']];
  await assert.rejects(() => removerRegistroDaPlanilhaOficial('orientacoes', { orientacao_id: 'ori-1' }), /duplicada/);
  assert(!calls.some(c => c.init.method === 'POST'), 'Unsafe delete must not be submitted');

  // 6. Schema desconhecido: impedir gravação silenciosa da linha vazia.
  calls = [];
  sheetRows = [['entrega_id', 'matricula_id']];
  await assert.rejects(() => gravarRegistroNaPlanilhaOficial('entregas', { codigo_inexistente: 'x' }), /incompatível/);
  assert(!calls.some(c => c.init.method === 'POST'), 'Incompatible record must not be appended');

  console.log('[PASS] 6 grupos de testes da API do Google Sheets.');
} finally {
  globalThis.fetch = originalFetch;
  clearAccessToken();
}
