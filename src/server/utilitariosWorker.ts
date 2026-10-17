/**
 * Auxiliares do Worker. Ficam FORA de worker.ts de propósito: o módulo de entrada do Cloudflare
 * só pode exportar o handler e as classes de Durable Object; qualquer outro export impede o Worker de iniciar.
 */
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

const BASE_SHEETS_PADRAO='https://sheets.googleapis.com/v4/spreadsheets/';
export function baseSheets(env:{SHEETS_API_BASE?:string}):string{
  const o=env.SHEETS_API_BASE;
  return o&&/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(o)?o.replace(/\/?$/,'/'):BASE_SHEETS_PADRAO;
}
