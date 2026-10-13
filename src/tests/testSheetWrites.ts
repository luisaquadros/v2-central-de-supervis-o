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
  normalizarLinhasDaAba,
} from '../services/googleSheetsService';

const originalFetch = globalThis.fetch;
let calls: { url: string; init: RequestInit; body: any }[] = [];
let sheetRows: any[][] = [];
const jsonOk = (data: any) => ({ ok: true, status: 200, json: async () => data }) as Response;

const SHEETS: Record<string, number> = {
  orientacoes: 11,
  entregas: 12,
  frequencias: 13,
  avaliacoes: 14,
  encontros_turma: 15,
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
  if (u.includes(':batchUpdate') || (init?.method === 'POST' && u.includes(':append?')) || init?.method === 'PUT') return jsonOk({ updatedRows: 1 });
  throw new Error('Unexpected URL in test: ' + u);
}) as typeof fetch;

const requiredWrite = (method: string) => {
  const c = [...calls].reverse().find(x => x.init.method === method);
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
  assert(create.url.includes(':append?'), 'append method suffix is mandatory');
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

  // 4b. Presença com atraso deve continuar sendo ATRASO na planilha.
  calls = [];
  sheetRows = [
    ['frequencia_id', 'matricula_id', 'data_aula', 'status', 'justificativa'],
    ['f-1', 'm-1', '2026-10-13', 'ATRASO', ''],
  ];
  await gravarRegistroNaPlanilhaOficial('frequencias', {
    frequencia_id: 'f-1', matricula_id: 'm-1',
    data_aula: '2026-10-13', status: 'PRESENTE', atraso: true,
  });
  assert.equal(requiredWrite('PUT').body.values[0][3], 'ATRASO', 'Não perder atraso na persistência');

  // 4c. Encerramento da aula deve possuir caminho de gravação real.
  calls = [];
  sheetRows = [['encontro_id','turma_id','periodo_id','data','status','chamada_salva','total_presentes','total_faltas']];
  await gravarRegistroNaPlanilhaOficial('encontros_turma', {
    encontro_id:'enc-1',turma_id:'tur-1',periodo_id:'sem-1',data:'2026-10-13',
    status:'REALIZADO',chamada_salva:true,total_presentes:12,total_faltas:2,
  });
  const encerramento = requiredWrite('POST');
  assert.equal(encerramento.body.values[0][4], 'REALIZADO');
  assert.equal(encerramento.body.values[0][5], 'TRUE');

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

  // 7. Cabeçalhos reais das fontes acadêmicas devem ser normalizados.
  const entregas = normalizarLinhasDaAba('entregas', [
    { entrega_id: 'e1', tipo_entrega: 'RELATORIO', status: 'ENTREGUE', data_envio: '2026-10-13' },
  ]);
  assert.equal(entregas[0].tipo_documento, 'RELATORIO');
  assert.equal(entregas[0].status_entrega, 'ENTREGUE');
  const leituras = normalizarLinhasDaAba('leituras_responsaveis', [
    { leitura_agenda_id: 'l1', data_discussao: '2026-10-13', titulo: 'Exemplo' },
  ]);
  assert.equal(leituras[0].data, '2026-10-13');
  assert.equal(leituras[0].leitura_id, 'l1');
  const rss = normalizarLinhasDaAba('registros_semanais', [
    { semana_rss: '7', registro_id: 'r1' },
  ]);
  assert.equal(rss[0].semana, '7');

  // Primary key must not depend on column order or accidentally use matricula_id.
  calls = [];
  sheetRows = [['matricula_id', 'orientacao_id', 'texto'], ['m-1', 'ori-1', 'antigo']];
  await gravarRegistroNaPlanilhaOficial('orientacoes', {matricula_id:'m-1', orientacao_id:'ori-2', texto:'novo'});
  requiredWrite('POST');
  calls = [];
  sheetRows = [['orientacao_id', 'texto'], ['ori-1', 'a'], ['ori-1', 'b']];
  await assert.rejects(() => gravarRegistroNaPlanilhaOficial('orientacoes', {orientacao_id:'ori-1', texto:'c'}), /duplicada/);
  assert(!calls.some(c => c.init.method === 'PUT'));
  calls = [];
  sheetRows = [['orientacao_id', 'texto']];
  await removerRegistroDaPlanilhaOficial('orientacoes', {orientacao_id:'already-deleted'});
  assert(!calls.some(c => c.init.method === 'POST'));

  // Notas devem ser números da API, inclusive em planilha pt-BR.
  // Textos continuam RAW, sem interpretar conteúdo como fórmula.
  calls = [];
  sheetRows = [['avaliacao_id', 'matricula_id', 'criterio_id', 'nota', 'observacao']];
  await gravarRegistroNaPlanilhaOficial('avaliacoes', {
    avaliacao_id:'av-01',matricula_id:'mat-01',criterio_id:'PROVA',nota:1.8,observacao:'=1+1'
  });
  const notaNova = requiredWrite('POST');
  assert.equal(typeof notaNova.body.values[0][3], 'number');
  assert.equal(notaNova.body.values[0][3], 1.8);
  assert.equal(notaNova.body.values[0][4], '=1+1', 'comentário deve continuar sendo texto RAW');

  calls = [];
  sheetRows = [['avaliacao_id', 'matricula_id', 'criterio_id', 'nota'],['av-01','mat-01','PROVA','1,8']];
  await gravarRegistroNaPlanilhaOficial('avaliacoes', {
    avaliacao_id:'av-01',matricula_id:'mat-01',criterio_id:'PROVA',nota:'0'
  });
  assert.equal(requiredWrite('PUT').body.values[0][3], 0, 'nota zero é um lançamento válido');

  calls = [];
  sheetRows = [['avaliacao_id', 'matricula_id', 'criterio_id', 'nota']];
  await assert.rejects(() => gravarRegistroNaPlanilhaOficial('avaliacoes', {
    avaliacao_id:'av-02',matricula_id:'mat-02',criterio_id:'PROVA',nota:'=2+2'
  }), /Nota inválida/);
  assert(!calls.some(c => c.init.method === 'POST'));

  console.log('[PASS] 11 grupos de testes da API do Google Sheets.');
} finally {
  globalThis.fetch = originalFetch;
  clearAccessToken();
}
