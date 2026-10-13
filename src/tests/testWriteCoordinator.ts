import assert from 'node:assert/strict';
import { WriteCoordinator } from '../server/worker';
let rows:any[][]=[['avaliacao_id','nota'],['a1',5]];
let writes=0;
const oldFetch=globalThis.fetch;
const ok=(data:unknown)=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
globalThis.fetch=async (input:any,init?:RequestInit):Promise<Response>=>{
  const url=String(input);
  if(!url.includes('sheets.googleapis.com'))throw Error('Unexpected request '+url);
  // Trilha de auditoria (log_alteracoes): coberta em testAuditoriaLog.ts; aqui só aceita as chamadas.
  if(url.includes('fields=sheets'))return ok({sheets:[{properties:{title:'log_alteracoes',sheetId:99}}]});
  if(url.includes('log_alteracoes'))return ok({});
  if(url.includes('/values:batchUpdate') && init?.method==='POST'){
    const body=JSON.parse(String(init.body));
    for(const p of body.data){
      const col=p.range.match(/!([A-Z]+)(\d+)$/);
      assert(col);
      const index=col[1].split('').reduce((n:number,c:string)=>n*26+c.charCodeAt(0)-64,0)-1;
      rows[Number(col[2])-1][index]=p.values[0][0];
    }
    writes++;return ok({totalUpdatedCells:body.data.length});
  }
  if(url.includes(':append?') && init?.method==='POST'){
    rows.push(JSON.parse(String(init.body)).values[0]);writes++;return ok({});
  }
  if(init?.method==='POST')throw Error('Unexpected POST '+url);
  return ok({values:rows});
};
const store=new Map<string,unknown>();
const server=new WriteCoordinator({storage:{
  get:async(k:string)=>store.get(k),
  put:async(k:string,v:unknown)=>{store.set(k,v);}
}} as any,{} as any);
const submit=(operacaoId:string,esperado:any,nota:number,tipo='UPDATE')=>
  server.fetch(new Request('https://internal/write',{
    method:'POST',headers:{Authorization:'Bearer mock','Content-Type':'application/json','X-Usuario-Verificado':'prof@exemplo.com'},
    body:JSON.stringify({tabela:'avaliacoes',tipo,operacaoId,registro:{avaliacao_id:'a1',nota},esperado})
  }));
try{
  assert.equal((await submit('id-one-123',{avaliacao_id:'a1',nota:5},7)).status,200);
  assert.equal(rows[1][1],7);
  assert.equal((await submit('id-two-123',{avaliacao_id:'a1',nota:5},9)).status,409,'versão obsoleta deve ser rejeitada');
  assert.equal(rows[1][1],7);
  assert.equal((await (await submit('id-one-123',{avaliacao_id:'a1',nota:5},7)).json()).replayed,true,'retentativa não pode gravar 2 vezes');
  assert.equal(writes,1);
  const concorrentes=await Promise.all([
    submit('id-three-123',{avaliacao_id:'a1',nota:7},8),
    submit('id-four-123',{avaliacao_id:'a1',nota:7},9)
  ]);
  assert.deepEqual(concorrentes.map(x=>x.status).sort(),[200,409]);
  assert.equal(writes,2);
  assert.equal(rows[1][1],8);
  console.log('Coordenador: serialização, CAS, retry idempotente e conflito concorrente validados.');
}finally{globalThis.fetch=oldFetch}

// Limite de corpo do Worker: vale para o corpo real, mesmo sem Content-Length (envio em partes).
{
  const { lerCorpoLimitado, LIMITE_CORPO } = await import('../server/utilitariosWorker');
  const pequeno = new Request('https://x/api/critical-write', { method: 'POST', body: '{"ok":true}' });
  assert.equal(await lerCorpoLimitado(pequeno, LIMITE_CORPO), '{"ok":true}', 'corpo pequeno passa');
  const partes = new ReadableStream({
    start(c) { const bloco = new TextEncoder().encode('x'.repeat(40000)); for (let i = 0; i < 4; i++) c.enqueue(bloco); c.close(); },
  });
  const grande = new Request('https://x/api/critical-write', { method: 'POST', body: partes, duplex: 'half' } as RequestInit);
  assert.equal(grande.headers.get('Content-Length'), null, 'sem Content-Length declarado');
  assert.equal(await lerCorpoLimitado(grande, LIMITE_CORPO), null, '160 KB em partes é recusado (limite 128 KB)');
  assert.equal(await lerCorpoLimitado(new Request('https://x/', { method: 'POST' }), LIMITE_CORPO), '', 'sem corpo = vazio');
  console.log('Worker: limite de corpo real validado (inclusive sem Content-Length).');
}
