import { getAccessToken } from './googleSheetsService';
import type { Aluno, Matricula, Turma } from '../types';

export const CENTRAL_CONTROLE_ORIGINAL_ID = '1fIT3binQZSGz2tVkaEZG5V8jeCUapc9JL5e_-h37lwk';
const fmt = (value: unknown) => String(value ?? '').trim().normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase();

const ALIASES: Record<string,string> = {
  'clinica ampliada matutino':'turma-ca-mat',
  'clinica ampliada noturno':'turma-ca-not',
  'clinica adulto estagio 1':'5a7f6bbd-6245-4878-8c1a-0f7989a80094',
  'infantojuvenil estagio 2':'a8622b75-cede-4571-9eb6-3fa9a47897f0',
  'saude mental no trabalho estagio 2':'turma-smt',
  'consultoria organizacional estagio 3':'4ce77806-50c5-4832-9850-26db997ee5a8',
};

export interface DiagnosticoCentralControle {
  lidos: number; vinculados: number; naoVinculados: number;
  ambiguos: number; turmasDesconhecidas: number;
  divergenciasDocumentais: number; pendenteAutorizacaoRegistroSemanal: boolean;
  autorizadoParaImportacao: false;
}

/** Apenas confere IDs e status. Não escreve nada, não exibe informações pessoais. */
export function diagnosticarCentralControle(
  values: unknown[][], turmas: Turma[], matriculas: Matricula[], alunos: Aluno[],
  entregas: Record<string,unknown>[],
): DiagnosticoCentralControle {
  const headers=(values[5]||[]).map(fmt);
  for(const key of ['turma','aluno(a)','e-mail','manual do estagio','termo de compromisso','documentacao externa']) {
    if(!headers.includes(key)) throw new Error('Cabeçalho da Central de Controle incompatível: ' + key);
  }
  const col=(k:string)=>headers.indexOf(k);
  const byEmail=new Map<string, string[]>();
  const alunoById=new Map(alunos.map(a=>[a.aluno_id,a]));
  matriculas.forEach(m=>{
    const a=alunoById.get(m.aluno_id);
    const email=fmt((a as unknown as {email?:string})?.email);
    if(email)byEmail.set(email,[...(byEmail.get(email)||[]),m.matricula_id]);
  });
  const matriculaById=new Map(matriculas.map(m=>[m.matricula_id,m]));
  const idsTurmas=new Set(turmas.map(t=>t.turma_id));
  let lidos=0,vinculados=0,naoVinculados=0,ambiguos=0,turmasDesconhecidas=0,divergenciasDocumentais=0;
  for(const row of values.slice(6)) {
    if(!row.some(x=>fmt(x)))continue;
    const turmaTexto=fmt(row[col('turma')]).replace(/\s*[—–-]\s*/g,' ');
    const turmaId=ALIASES[turmaTexto];
    const email=fmt(row[col('e-mail')]);
    if(!email&&!fmt(row[col('aluno(a)')])) continue;
    lidos++;
    if(!turmaId||!idsTurmas.has(turmaId)){turmasDesconhecidas++;continue;}
    const matches=(byEmail.get(email)||[]).filter(id=>matriculaById.get(id)?.turma_id===turmaId);
    if(matches.length!==1){if(matches.length>1) ambiguos++;else naoVinculados++;continue;}
    vinculados++;
    const types=[['manual do estagio','MANUAL_ESTAGIO'],['termo de compromisso','TERMO_COMPROMISSO'],['documentacao externa','DOCUMENTACAO_EXTERNA']];
    for(const [coluna,tipo] of types){
      const source=fmt(row[col(coluna)]);
      const dest=entregas.filter(e=>e.matricula_id===matches[0]&&e.tipo_entrega===tipo);
      if(dest.length!==1||fmt(dest[0].status)!==source)divergenciasDocumentais++;
    }
  }
  return {lidos,vinculados,naoVinculados,ambiguos,turmasDesconhecidas,divergenciasDocumentais,
    pendenteAutorizacaoRegistroSemanal: String(values[2]?.[2]??'').includes('#REF!'),
    autorizadoParaImportacao:false};
}

export async function lerCentralControleSomenteLeitura(
  turmas: Turma[], matriculas: Matricula[], alunos: Aluno[], entregas: Record<string,unknown>[]
):Promise<DiagnosticoCentralControle>{
  const token=await getAccessToken();
  if(!token)throw new Error('Conecte o Google Sheets para conferir a Central de Controle.');
  const range=encodeURIComponent("'Base de alunos'!A1:V600");
  const res=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CENTRAL_CONTROLE_ORIGINAL_ID}/values/${range}`,{
    headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)
  });
  if(!res.ok)throw new Error('Não foi possível ler a Central de Controle original ('+res.status+'). Confira as permissões.');
  const json=await res.json();
  return diagnosticarCentralControle(json.values||[],turmas,matriculas,alunos,entregas);
}
