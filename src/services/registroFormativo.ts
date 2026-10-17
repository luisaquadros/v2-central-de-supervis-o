export interface IndicadoresFormativos {participacao:string;leituraDirigida:string;casoCompartilhado:string;observacao:string}
const PADRAO='NAO_REGISTRADO';
const interpretar=(s:string):string => ['SIM','NAO','NAO_SE_APLICA','NAO_REGISTRADO'].includes(s.trim())?s.trim():PADRAO;
export function interpretarRegistroFormativo(texto:string):IndicadoresFormativos {
 const linha=(rotulo:string)=>texto.split('\n').find(x=>x.startsWith(rotulo))?.slice(rotulo.length)??'';
 const p=linha('Participação na discussão: ');
 const l=linha('Leitura dirigida: ');
 const c=linha('Compartilhamento de caso: ');
 const index=texto.indexOf('\nObservação da professora: ');
 return {participacao:interpretar(p),leituraDirigida:interpretar(l),casoCompartilhado:interpretar(c),observacao:index<0?'':texto.slice(index+'\nObservação da professora: '.length)};
}
export function serializarRegistroFormativo(v:IndicadoresFormativos):string {
 return 'Participação na discussão: '+interpretar(v.participacao)
   +'\nLeitura dirigida: '+interpretar(v.leituraDirigida)
   +'\nCompartilhamento de caso: '+interpretar(v.casoCompartilhado)
   +(v.observacao.trim()?'\nObservação da professora: '+v.observacao.trim().slice(0,1500):'');
}
