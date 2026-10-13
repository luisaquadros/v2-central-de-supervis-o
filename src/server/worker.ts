import { LIMITE_CORPO, lerCorpoLimitado, baseSheets } from './utilitariosWorker';
import { autenticarPerfil, type AmbienteAutorizacao } from './autorizacao';
import { podeEscreverTabela, turmaPermitida, turmaDoRegistro, filtrarLeitura, tabelaLegivelPor, LEITURA_MONITORA, type Perfil } from './acessos';
import { tokenContaServico, ContaServicoIndisponivel, ESCOPO_SHEETS, ESCOPO_DRIVE_METADADOS, type AmbienteContaServico } from './contaServico';
import { sincronizarDocumentos, CRONS_SINCRONIZACAO, HORARIOS_BRASILIA, JANELA_PADRAO_DIAS, ABA_MONITORAMENTO } from './sincronizacaoDocumentos';
import { compararVersaoDeCampos, adaptarRegistroCritico, idCritico, TABELAS_CRITICAS, resumirAlteracaoParaLog, linhaDeLog, COLUNAS_LOG_ALTERACOES, type EscritaCritica } from './coordenacaoCritica';

const SPREADSHEET_ID='1DwhmASMStNtT_L2YinG-jkP9vYVv5ETdc-azYqSSIc4';
interface DurableStorage {get<T>(key:string):Promise<T|undefined>;put(key:string,value:unknown):Promise<void>}
interface DurableState {storage:DurableStorage}
interface Namespace {idFromName(key:string):unknown;get(id:unknown):{fetch(request:Request):Promise<Response>}}
interface Env extends AmbienteAutorizacao, AmbienteContaServico {ASSETS:{fetch(request:Request):Promise<Response>};WRITE_COORDINATOR:Namespace;
  /** 'ligada' habilita a sincronização de metadados do Drive (manual e agendada). Qualquer outro valor = desligada. */SINCRONIZACAO_DOCUMENTOS?:string;
  JANELA_DOCUMENTOS_DIAS?:string;
  /** Somente testes locais: precisam ser loopback. */SHEETS_API_BASE?:string;DRIVE_API_BASE?:string}
const DRIVE_PADRAO='https://www.googleapis.com/drive/v3';
const driveBase=(env:{DRIVE_API_BASE?:string}):string=>{const o=env.DRIVE_API_BASE;return o&&/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(o)?o.replace(/\/+$/,''):DRIVE_PADRAO};
const lerPerfil=(request:Request):Perfil|null=>{try{const p=JSON.parse(request.headers.get('X-Perfil')||'null');return p&&(p.papel==='PROFESSORA_ADMIN'||p.papel==='MONITORA')?p as Perfil:null}catch{return null}};


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

/** Garante a aba do log (criada só na primeira gravação) e acrescenta uma linha. Nunca altera outras abas. */
async function anexarLog(base:string,token:string,linha:string[]):Promise<void>{
  const URL_BASE=base+SPREADSHEET_ID;
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

const janelaDias=(env:{JANELA_DOCUMENTOS_DIAS?:string}):number=>{const n=Number(env.JANELA_DOCUMENTOS_DIAS);return Number.isInteger(n)&&n>=1&&n<=90?n:JANELA_PADRAO_DIAS};
/** Acrescenta uma linha numa aba que já existe (não cria abas). */
async function anexarEmAbaExistente(base:string,token:string,aba:string,linha:string[]):Promise<void>{
  await googleFetch(base+SPREADSHEET_ID+'/values/'+encodeURIComponent(quoted(aba)+'!A1')+':append?valueInputOption=RAW',token,{method:'POST',body:JSON.stringify({values:[linha]})});
}

export class WriteCoordinator {
  private tail:Promise<unknown>=Promise.resolve();
  private base:string;
  private env:Env;
  private sincronizando=false;
  constructor(private state:DurableState,env:Env){this.env=(env??{}) as Env;this.base=baseSheets(this.env)}
  async fetch(request:Request):Promise<Response>{
    const caminho=new URL(request.url).pathname;
    if(caminho==='/estado')return this.estadoSincronizacao();
    if(caminho==='/sync'){
      // Uma execução por vez: se já há uma em andamento, esta é recusada (não fica na fila para rodar de novo em seguida).
      if(this.sincronizando)return fail('Já existe uma sincronização em andamento.',409,'SINCRONIZACAO_EM_ANDAMENTO');
      this.sincronizando=true;
      const t=()=>this.performSync(request).finally(()=>{this.sincronizando=false});
      const r=this.tail.then(t,t);
      this.tail=r.then(()=>undefined,()=>undefined);
      return r;
    }
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
      try{if(!restantes.length)await anexarLog(this.base,token,linha);else restantes.push(linha)}
      catch{restantes.push(linha)}
    }
    await this.state.storage.put('logs-pendentes',restantes);
  }
  private async estadoSincronizacao():Promise<Response>{
    const historico=(await this.state.storage.get<unknown[]>('sync-historico'))||[];
    return json({ok:true,ligada:this.env.SINCRONIZACAO_DOCUMENTOS==='ligada',em_andamento:this.sincronizando,
      janela_dias:janelaDias(this.env),agendamentos:CRONS_SINCRONIZACAO.map(c=>({cron:c,horario_brasilia:HORARIOS_BRASILIA[c]})),historico:historico.slice(0,10)});
  }
  private async registrarExecucao(resultado:unknown):Promise<void>{
    const atual=(await this.state.storage.get<unknown[]>('sync-historico'))||[];
    await this.state.storage.put('sync-historico',[resultado,...atual].slice(0,30));
  }
  private async performSync(request:Request):Promise<Response>{
    const agendado=request.headers.get('X-Agendado');
    const perfil=lerPerfil(request);
    if(!agendado&&perfil?.papel!=='PROFESSORA_ADMIN')return fail('Somente a professora administradora sincroniza.',403,'NAO_AUTORIZADO');
    if(this.env.SINCRONIZACAO_DOCUMENTOS!=='ligada')return fail('A sincronização de documentos está desligada neste ambiente (SINCRONIZACAO_DOCUMENTOS).',409,'SINCRONIZACAO_DESLIGADA');
    const modo=agendado?'AGENDADO' as const:'MANUAL' as const, inicio=new Date();
    let token:string;
    try{token=await tokenContaServico(this.env,[ESCOPO_SHEETS,ESCOPO_DRIVE_METADADOS])}
    catch(e){
      const mensagem=e instanceof ContaServicoIndisponivel?e.message:'Conta de serviço indisponível.';
      await this.registrarExecucao({status:'FALHA',modo,cron:agendado||undefined,inicio:inicio.toISOString(),fim:new Date().toISOString(),lidos:0,consultados:0,atualizados:0,erros:{CONTA_SERVICO:1},mensagem});
      return fail(mensagem,503,'CONTA_SERVICO_INDISPONIVEL');
    }
    const {resultado,linhaHistorico}=await sincronizarDocumentos({planilhaId:SPREADSHEET_ID,sheetsBase:this.base,driveBase:driveBase(this.env),
      tokenSheets:token,tokenDrive:token,agora:inicio,janelaDias:janelaDias(this.env)},modo,agendado||undefined);
    await this.registrarExecucao(resultado);
    // Histórico na aba `sincronizacao` (só se existir) e resumo no log de alterações; falha aqui não desfaz a sincronização.
    let historicoGravado=true;
    try{await anexarEmAbaExistente(this.base,token,'sincronizacao',linhaHistorico)}catch{historicoGravado=false}
    try{await anexarLog(this.base,token,['sync-'+inicio.getTime().toString(36),resultado.fim,'sistema:sincronizacao-documentos',ABA_MONITORAMENTO,'*','SYNC',
      'data_modificacao_drive, consultado_em, status, erro_codigo','{}',JSON.stringify({status:resultado.status,lidos:resultado.lidos,atualizados:resultado.atualizados}),'CENTRAL_WORKER'])}catch{historicoGravado=false}
    return json({ok:true,resultado,historico_gravado:historicoGravado});
  }
  private async perform(request:Request):Promise<Response>{
    try {
      const perfil=lerPerfil(request);
      if(!perfil)return fail('Perfil verificado ausente.',401,'TOKEN_AUSENTE');
      // Administradora grava com o próprio acesso Google. Monitora NÃO usa credencial Google própria:
      // o servidor grava com a conta de serviço, depois de validar permissão e turma.
      let token:string;
      if(perfil.papel==='MONITORA'){
        try{token=await tokenContaServico(this.env,[ESCOPO_SHEETS])}
        catch(e){return fail(e instanceof ContaServicoIndisponivel?e.message:'Conta de serviço indisponível.',503,'CONTA_SERVICO_INDISPONIVEL')}
      }else{
        const bearer=request.headers.get('Authorization')||'';
        if(!/^Bearer \S+$/.test(bearer))return fail('Autenticação Google necessária.',401);
        token=bearer.slice(7);
      }
      // O DO só é alcançável pelo handler externo, que já verificou a identidade. Defesa em profundidade:
      const usuarioVerificado=request.headers.get('X-Usuario-Verificado')||'';
      if(!usuarioVerificado)return fail('Identidade verificada ausente.',401,'TOKEN_AUSENTE');
      const payload=await request.json() as EscritaCritica;
      if(!payload||!TABELAS_CRITICAS.has(payload.tabela)||!['INSERT','UPDATE','DELETE'].includes(payload.tipo)||
         !payload.operacaoId||!/^[-a-zA-Z0-9_:]{8,100}$/.test(payload.operacaoId)||!payload.registro||typeof payload.registro!=='object')
        return fail('Operação crítica inválida.',400);
      const liberada=podeEscreverTabela(perfil,payload.tabela,payload.tipo);
      if(!liberada.ok)return fail(liberada.message,403,liberada.code);
      await this.reenviarLogsPendentes(token);
      const receipt='op:'+payload.operacaoId;
      // A mesma operação só pode ser aplicada uma vez, mesmo após reenvio da fila offline.
      if(await this.state.storage.get(receipt)) return json({ok:true,replayed:true});
      const table=payload.tabela;
      const read=await googleFetch(
        this.base+SPREADSHEET_ID+
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
      if(perfil.papel==='MONITORA'){
        const mats=await googleFetch(this.base+SPREADSHEET_ID+'/values/'+encodeURIComponent(quoted('matriculas')+'!A1:ZZ'),token);
        const mr=(mats.values||[]) as unknown[][];const mh=(mr[0]||[]).map(x=>String(x).trim());
        const turmaPorMatricula=new Map(mr.slice(1).map(c=>[String(c[mh.indexOf('matricula_id')]??'').trim(),String(c[mh.indexOf('turma_id')]??'').trim()]));
        const busca=(id:string)=>turmaPorMatricula.get(id)||undefined;
        // A turma do registro novo E a do registro existente precisam ser da monitora (não dá para "mover" um registro alheio).
        for(const alvo of [payload.registro,remote as Record<string,unknown>|null]){
          if(!alvo)continue;
          const d=turmaPermitida(perfil,turmaDoRegistro(alvo,busca));
          if(!d.ok)return fail(d.message,403,d.code);
        }
      }
      const divergencias=compararVersaoDeCampos(table,payload.registro,payload.esperado,remote,headers,payload.tipo);
      if(divergencias.length)return json({ok:false,code:'VERSION_CONFLICT',campos:divergencias,
        message:'Conflito de versão ou registro inexistente. Atualize e revise a alteração antes de reenviar.'},409);
      const registro=adaptarRegistroCritico(table,payload.registro);
      const columns=headers.map((h,index)=>({h,index})).filter(x=>Object.prototype.hasOwnProperty.call(registro,x.h));
      if(payload.tipo==='DELETE'){
        const meta=await googleFetch(
          this.base+SPREADSHEET_ID+
          '?fields='+encodeURIComponent('sheets(properties(title,sheetId))'),token);
        const sheet=(meta.sheets||[]).find((x:any)=>x.properties.title===table);
        if(!sheet)return fail('Aba não encontrada.',409,'SCHEMA_MISMATCH');
        await googleFetch(this.base+SPREADSHEET_ID+':batchUpdate',token,{
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
        await googleFetch(this.base+SPREADSHEET_ID+
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
        await googleFetch(this.base+SPREADSHEET_ID+
          '/values:batchUpdate',token,{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data})});
      }
      // O recibo contém somente o identificador da operação, sem dados dos estudantes.
      await this.state.storage.put(receipt,{ok:true,at:Date.now()});
      // A gravação já está confirmada. Se o log falhar, a linha fica guardada e é reenviada na próxima operação.
      const linhaLog=linhaDeLog(payload.operacaoId,new Date().toISOString(),usuarioVerificado,table,payload.tipo,
        resumirAlteracaoParaLog(table,payload.tipo,payload.registro,remote,headers));
      let auditoria=true;
      try{await anexarLog(this.base,token,linhaLog)}
      catch{auditoria=false;await this.guardarLogPendente(linhaLog)}
      return json({ok:true,replayed:false,auditoria});
    }catch(error:any){
      return fail(error?.http===401?'Sessão Google expirada.':error?.message||'Falha no servidor.',
        error?.http===401?401:error?.http===403?403:502);
    }
  }
}

const ROTAS_API=new Set(['/api/critical-write','/api/acesso','/api/leitura','/api/documentos/sincronizar','/api/documentos/estado']);
const coordenador=(env:Env)=>env.WRITE_COORDINATOR.get(env.WRITE_COORDINATOR.idFromName(SPREADSHEET_ID));
const perfilPublico=(p:Perfil)=>({papel:p.papel,email:p.email,turmas:p.turmas,operacoes:p.operacoes});

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);
    if(!ROTAS_API.has(url.pathname)) return env.ASSETS.fetch(request);
    const origin=request.headers.get('Origin');
    if(origin && origin!==url.origin)return fail('Origem não permitida.',403);
    // Autenticação e autorização NO SERVIDOR: identidade = token de ID do Firebase verificado aqui;
    // perfil = configuração do Worker. O e-mail enviado pelo aplicativo nunca é usado.
    const auth=await autenticarPerfil(request.headers.get('X-Firebase-Id-Token'),env);
    if(!auth.ok)return fail(auth.message,auth.status,auth.code);
    const perfil=auth.perfil;

    if(url.pathname==='/api/acesso'){
      if(request.method!=='GET')return fail('Método não permitido.',405);
      return json({ok:true,...perfilPublico(perfil),avisos:perfil.papel==='PROFESSORA_ADMIN'?auth.config.avisos:[]});
    }

    if(url.pathname==='/api/leitura'){
      if(request.method!=='GET')return fail('Método não permitido.',405);
      const pedidas=(url.searchParams.get('tabelas')||'').split(',').map(x=>x.trim()).filter(Boolean);
      if(!pedidas.length||pedidas.length>60)return fail('Informe as tabelas (até 60).',400,'PEDIDO_INVALIDO');
      const negadas=pedidas.filter(t=>!tabelaLegivelPor(perfil,t));
      if(negadas.length)return fail('Tabela não disponível para este perfil: '+negadas.join(', ')+'.',403,'TABELA_NAO_DELEGADA');
      let token:string;
      try{token=await tokenContaServico(env,[ESCOPO_SHEETS])}
      catch(e){return fail(e instanceof ContaServicoIndisponivel?e.message:'Conta de serviço indisponível.',503,'CONTA_SERVICO_INDISPONIVEL')}
      const base=baseSheets(env)+SPREADSHEET_ID;
      const contexto=perfil.papel==='MONITORA'?['matriculas','grupos_pratica']:[];
      const todas=[...new Set([...pedidas,...contexto])];
      const lido:Record<string,unknown[][]>={};
      try{
        const r=await googleFetch(base+'/values:batchGet?'+todas.map(t=>'ranges='+encodeURIComponent(quoted(t)+'!A1:ZZ')).join('&'),token);
        todas.forEach((t,i)=>{lido[t]=(r.valueRanges?.[i]?.values||[]) as unknown[][]});
      }catch(e:any){return fail(e?.message||'Falha na leitura.',e?.http===403?403:502,'LEITURA_FALHOU')}
      const objs=(t:string)=>{const v=lido[t]||[];const h=(v[0]||[]).map(x=>String(x).trim());return v.slice(1).map(l=>Object.fromEntries(h.map((c,i)=>[c,l[i]??''])))};
      const tabelas:Record<string,{values:unknown[][]}>={};
      for(const t of pedidas)tabelas[t]={values:filtrarLeitura(t,lido[t]||[],perfil,{matriculas:objs('matriculas'),grupos:objs('grupos_pratica')})||[]};
      return json({ok:true,papel:perfil.papel,tabelas});
    }

    if(url.pathname==='/api/documentos/estado'){
      if(request.method!=='GET')return fail('Método não permitido.',405);
      if(perfil.papel!=='PROFESSORA_ADMIN'&&!perfil.operacoes.includes('DOCUMENTOS_VER'))return fail('Sem permissão para ver a sincronização de documentos.',403,'OPERACAO_NAO_DELEGADA');
      return coordenador(env).fetch(new Request('https://internal/estado',{method:'GET'}));
    }

    if(url.pathname==='/api/documentos/sincronizar'){
      if(request.method!=='POST')return fail('Método não permitido.',405);
      if(perfil.papel!=='PROFESSORA_ADMIN')return fail('Somente a professora administradora sincroniza.',403,'NAO_AUTORIZADO');
      return coordenador(env).fetch(new Request('https://internal/sync',{method:'POST',headers:{'X-Perfil':JSON.stringify(perfilPublico(perfil))}}));
    }

    // /api/critical-write
    if(request.method!=='POST')return fail('Método não permitido.',405);
    // O limite vale para o corpo real: Content-Length pode faltar (envio em partes) ou mentir.
    if(Number(request.headers.get('Content-Length')||0)>LIMITE_CORPO)return fail('Operação muito grande.',413);
    const corpo=await lerCorpoLimitado(request,LIMITE_CORPO);
    if(corpo===null)return fail('Operação muito grande.',413);
    return coordenador(env).fetch(new Request('https://internal/write',{
      method:'POST',
      headers:{Authorization:request.headers.get('Authorization')||'','Content-Type':'application/json','X-Usuario-Verificado':perfil.email,'X-Perfil':JSON.stringify(perfilPublico(perfil))},
      body:corpo,
    }));
  },

  /** Cron Triggers. Só age se SINCRONIZACAO_DOCUMENTOS='ligada' e se o cron é um dos dois horários previstos. */
  async scheduled(event:{cron:string},env:Env,ctx:{waitUntil(p:Promise<unknown>):void}):Promise<void>{
    if(env.SINCRONIZACAO_DOCUMENTOS!=='ligada')return;
    if(!(CRONS_SINCRONIZACAO as readonly string[]).includes(event.cron))return;
    ctx.waitUntil(coordenador(env).fetch(new Request('https://internal/sync',{method:'POST',headers:{'X-Agendado':event.cron}})).then(()=>undefined));
  }
};
