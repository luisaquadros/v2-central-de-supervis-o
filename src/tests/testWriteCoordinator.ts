import assert from 'node:assert/strict';
import { WriteCoordinator } from '../server/worker';
let rows:any[][]=[['avaliacao_id','nota'],['a1',5]];
let writes=0;
const oldFetch=globalThis.fetch;
const ok=(data:unknown)=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
globalThis.fetch=async (input:any,init?:RequestInit):Promise<Response>=>{
  const url=String(input);
  if(!url.includes('sheets.googleapis.com'))throw Error('Unexpected request '+url);
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
    method:'POST',headers:{Authorization:'Bearer mock','Content-Type':'application/json'},
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
