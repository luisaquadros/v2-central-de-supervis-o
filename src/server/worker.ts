import { compararVersaoDeCampos, adaptarRegistroCritico, idCritico, TABELAS_CRITICAS, resumirAlteracaoParaLog, linhaDeLog, COLUNAS_LOG_ALTERACOES, type EscritaCritica } from './coordenacaoCritica';

const SPREADSHEET_ID='1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4';
interface DurableStorage {get<T>(key:string):Promise<T|undefined>;put(key:string,value:unknown):Promise<void>}
interface DurableState {storage:DurableStorage}
interface Namespace {idFromName(key:string):unknown;get(id:unknown):{fetch(request:Request):Promise<Response>}}
interface Env {ASSETS:{fetch(request:Request):Promise<Response>};WRITE_COORDINATOR:Namespace}

export const LIMITE_CORPO=131072;
/** Lê o corpo em partes e aborta ao passar do limite. Devolve null se exceder. */
export async function lerCorpoLimitado(request:Request,limite:number):Promise<string|null>{
  if(!request.body)return '';
  const leitor=request.body.getReader();
  const decoder=new TextDecoder();
  let total=0,texto='';
  for(;;){
    const {done,value}=await leitor.read();
    if(done)break;
    total+=value.byteLength;
    if(total>limite){await leitor.cancel().catch(()=>{});return null}
    texto+=decoder.decode(value,{stream:true});
  }
  return texto+decoder.decode();
}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
});
const fail=(message:string,status:number,code='WRITE_FAILED')=>json({ok:false,code,message},status);
const colName=(index:number)=>{let i=index+1,out='';while(i>0){i--;out=String.fromCharCode(65+i%26)+out;i=Math.floor(i/26)}return out};
const quoted=(name:string)=>"'"+name.replaceAll("'","''")+"'";
async function googleFetch(url:string,token:string,init:RequestInit={}):Promise<any>{
  const response=await fetch(url,{
    ...init,headers:{Authorization:'Bearer '+token,...(init.body?{'Content-Type':'application/json'}:{})},
    signal:AbortSignal.timeout(20000)
  });
  if(!response.ok){
    if(response.status===401||response.status===403)throw Object.assign(new Error('A conta Google não autorizou a operação.'),{http:response.status});
    throw Object.assign(new Error('Erro da API Google Sheets ('+response.status+').'),{http:502});
  }
  return response.json();
}

const ABA_LOG='log_alteracoes';
const URL_BASE='https://sheets.googleapis.com/v4/spreadsheets/'+SPREADSHEET_ID;

/** Garante a aba do log (criada só na primeira gravação) e acrescenta uma linha. Nunca altera outras abas. */
async function anexarLog(token:string,linha:string[]):Promise<void>{
  const meta=await googleFetch(URL_BASE+'?fields='+encodeURIComponent('sheets(properties(title))'),token);
  const existe=(meta.sheets||[]).some((x:any)=>x.properties.title===ABA_LOG);
  if(!existe){
    await googleFetch(URL_BASE+':batchUpdate',token,{method:'POST',body:JSON.stringify({requests:[
      {addSheet:{properties:{title:ABA_LOG,gridProperties:{rowCount:1000,columnCount:COLUNAS_LOG_ALTERACOES.length}}}}]})});
    await googleFetch(URL_BASE+'/values/'+encodeURIComponent(quoted(ABA_LOG)+'!A1')+'?valueInputOption=RAW',token,
      {method:'PUT',body:JSON.stringify({values:[[...COLUNAS_LOG_ALTERACOES]]})});
  }
  await googleFetch(URL_BASE+'/values/'+encodeURIComponent(quoted(ABA_LOG)+'!A1')+':append?valueInputOption=RAW',token,
    {method:'POST',body:JSON.stringify({values:[linha]})});
}

export class WriteCoordinator {
  private tail:Promise<unknown>=Promise.resolve();
  constructor(private state:DurableState,_env:Env){}
  async fetch(request:Request):Promise<Response>{
    const task=()=>this.perform(request);
    const response=this.tail.then(task,task);
    this.tail=response.then(()=>undefined,()=>undefined);
    return response;
  }
  private async guardarLogPendente(linha:string[]):Promise<void>{
    const atuais=(await this.state.storage.get<string[][]>('logs-pendentes'))||[];
    await this.state.storage.put('logs-pendentes',[...atuais,linha].slice(-500));
  }
  private async reenviarLogsPendentes(token:string):Promise<void>{
    const pendentes=(await this.state.storage.get<string[][]>('logs-pendentes'))||[];
    if(!pendentes.length)return;
    const restantes:string[][]=[];
    for(const linha of pendentes){
      try{if(!restantes.length)await anexarLog(token,linha);else restantes.push(linha)}
      catch{restantes.push(linha)}
    }
    await this.state.storage.put('logs-pendentes',restantes);
  }
  private async perform(request:Request):Promise<Response>{
    try {
      const bearer=request.headers.get('Authorization')||'';
      if(!/^Bearer \S+$/.test(bearer))return fail('Autenticação Google necessária.',401);
      const token=bearer.slice(7);
      const payload=await request.json() as EscritaCritica;
      if(!payload||!TABELAS_CRITICAS.has(payload.tabela)||!['INSERT','UPDATE','DELETE'].includes(payload.tipo)||
         !payload.operacaoId||!/^[-a-zA-Z0-9_:]{8,100}$/.test(payload.operacaoId)||!payload.registro||typeof payload.registro!=='object')
        return fail('Operação crítica inválida.',400);
      await this.reenviarLogsPendentes(token);
      const receipt='op:'+payload.operacaoId;
      // A mesma operação só pode ser aplicada uma vez, mesmo após reenvio da fila offline.
      if(await this.state.storage.get(receipt)) return json({ok:true,replayed:true});
      const table=payload.tabela;
      const read=await googleFetch(
        'https://sheets.googleapis.com/v4/spreadsheets/'+SPREADSHEET_ID+
          '/values/'+encodeURIComponent(quoted(table)+'!A1:ZZ'),token
      );
      const rows=(read.values||[]) as unknown[][];
      const headers=(rows[0]||[]).map(x=>String(x).trim());
      if(!headers.length)return fail('A tabela oficial não possui cabeçalho.',409,'SCHEMA_MISMATCH');
      const matches=rows.slice(1).flatMap((cells,i)=>{
        const row=Object.fromEntries(headers.map((h,j)=>[h,cells[j]??'']));
        try{return idCritico(table,row)===idCritico(table,payload.registro)?[{index:i+2,row}]:[]}
        catch{return []}
      });
      if(matches.length>1)return fail('Identificadores duplicados na planilha; operação bloqueada.',409,'DUPLICATE_ID');
      const remote=matches[0]?.row??null;
      const divergencias=compararVersaoDeCampos(table,payload.registro,payload.esperado,remote,headers,payload.tipo);
      if(divergencias.length)return fail('Conflito de versão ou registro inexistente. Atualize e revise a alteração antes de reenviar.',409,'VERSION_CONFLICT');
      const registro=adaptarRegistroCritico(table,payload.registro);
      const columns=headers.map((h,index)=>({h,index})).filter(x=>Object.prototype.hasOwnProperty.call(registro,x.h));
      if(payload.tipo==='DELETE'){
        const meta=await googleFetch(
          'https://sheets.googleapis.com/v4/spreadsheets/'+SPREADSHEET_ID+
          '?fields='+encodeURIComponent('sheets(properties(title,sheetId))'),token);
        const sheet=(meta.sheets||[]).find((x:any)=>x.properties.title===table);
        if(!sheet)return fail('Aba não encontrada.',409,'SCHEMA_MISMATCH');
        await googleFetch('https://sheets.googleapis.com/v4/spreadsheets/'+SPREADSHEET_ID+':batchUpdate',token,{
          method:'POST',
          body:JSON.stringify({requests:[{deleteDimension:{range:{
            sheetId:sheet.properties.sheetId,dimension:'ROWS',
            startIndex:matches[0].index-1,endIndex:matches[0].index
          }}}]})
        });
      }else if(payload.tipo==='INSERT'){
        if(!columns.length)return fail('Nenhuma coluna correspondente.',409,'SCHEMA_MISMATCH');
        const values=headers.map(h=>{
          const v=registro[h];return v==null?'':typeof v==='boolean'?(v?'TRUE':'FALSE'):v
        });
        await googleFetch('https://sheets.googleapis.com/v4/spreadsheets/'+SPREADSHEET_ID+
          '/values/'+encodeURIComponent(quoted(table)+'!A1:ZZ')+':append?valueInputOption=RAW',token,{
          method:'POST',body:JSON.stringify({values:[values]})
        });
      }else {
        if(!columns.length)return fail('Nenhuma coluna correspondente.',409,'SCHEMA_MISMATCH');
        const data=columns.map(({h,index})=>{
          const v=registro[h];
          return {range:quoted(table)+'!'+colName(index)+matches[0].index,
            values:[[v==null?'':typeof v==='boolean'?(v?'TRUE':'FALSE'):v]]}
        });
        await googleFetch('https://sheets.googleapis.com/v4/spreadsheets/'+SPREADSHEET_ID+
          '/values:batchUpdate',token,{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data})});
      }
      // O recibo contém somente o identificador da operação, sem dados dos estudantes.
      await this.state.storage.put(receipt,{ok:true,at:Date.now()});
      // A gravação já está confirmada. Se o log falhar, a linha fica guardada e é reenviada na próxima operação.
      const usuario=typeof (payload as any).usuario==='string'?(payload as any).usuario:'';
      const linhaLog=linhaDeLog(payload.operacaoId,new Date().toISOString(),usuario,table,payload.tipo,
        resumirAlteracaoParaLog(table,payload.tipo,payload.registro,remote,headers));
      let auditoria=true;
      try{await anexarLog(token,linhaLog)}
      catch{auditoria=false;await this.guardarLogPendente(linhaLog)}
      return json({ok:true,replayed:false,auditoria});
    }catch(error:any){
      return fail(error?.http===401?'Sessão Google expirada.':error?.message||'Falha no servidor.',
        error?.http===401?401:error?.http===403?403:502);
    }
  }
}

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);
    if(url.pathname!=='/api/critical-write') return env.ASSETS.fetch(request);
    if(request.method!=='POST')return fail('Método não permitido.',405);
    const origin=request.headers.get('Origin');
    if(origin && origin!==url.origin)return fail('Origem não permitida.',403);
    // O limite vale para o corpo real: Content-Length pode faltar (envio em partes) ou mentir.
    if(Number(request.headers.get('Content-Length')||0)>LIMITE_CORPO)return fail('Operação muito grande.',413);
    const corpo=await lerCorpoLimitado(request,LIMITE_CORPO);
    if(corpo===null)return fail('Operação muito grande.',413);
    const object=env.WRITE_COORDINATOR.get(env.WRITE_COORDINATOR.idFromName(SPREADSHEET_ID));
    return object.fetch(new Request('https://internal/write',{
      method:'POST',
      headers:{Authorization:request.headers.get('Authorization')||'', 'Content-Type':'application/json'},
      body:corpo,
    }));
  }
};
