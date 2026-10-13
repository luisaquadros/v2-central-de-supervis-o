import type { RegistroSemanal, Matricula, Aluno, GrupoIntegrante, GrupoPratica } from '../types';

const id = (v: unknown) => String(v ?? '').trim();

/** Filtra RSS estritamente pela unidade acadêmica, sem misturar turmas ou grupos. */
export function selecionarRssDoEstudante(params: {
 matriculaId: string; turmaId: string; registros: RegistroSemanal[];
 matriculas: Matricula[]; alunos: Aluno[];
 grupos: GrupoPratica[]; integrantes: GrupoIntegrante[];
}) {
 const {matriculaId,turmaId,registros,matriculas,alunos,grupos,integrantes}=params;
 const matricula=matriculas.find(m=>id(m.matricula_id)===id(matriculaId) && id(m.turma_id)===id(turmaId));
 if(!matricula) return {registros:[],grupoId:undefined as string|undefined,modo:'SEM_MATRICULA' as const};
 const aluno=alunos.find(a=>id(a.aluno_id)===id(matricula.aluno_id));
 const gruposTurma=new Set(grupos.filter(g=>id(g.turma_id)===id(turmaId)).map(g=>id(g.grupo_id)));
 const vinculos=integrantes.filter(i=>gruposTurma.has(id(i.grupo_id)) && (
   id(i.matricula_id)===id(matriculaId) || (aluno && id(i.aluno_id)===id(aluno.aluno_id))
 ));
 const idsGrupo=[...new Set(vinculos.map(v=>id(v.grupo_id)))];
 if(gruposTurma.size>0) {
   if(idsGrupo.length!==1) return {registros:[],grupoId:undefined,modo:'GRUPO_AMBIGUO' as const};
   const grupoId=idsGrupo[0];
   return {grupoId,modo:'GRUPO' as const,registros:registros.filter(r=>{
     const reg=r as RegistroSemanal & {grupo_id?:string;turma_id?:string};
     return id(reg.grupo_id)===grupoId && id(reg.turma_id)===id(turmaId);
   })};
 }
 const ids=[id(matriculaId),id(aluno?.aluno_id),id(aluno?.identificador_academico)].filter(Boolean);
 return {grupoId:undefined,modo:'INDIVIDUAL' as const,registros:registros.filter(r=>{
   const reg=r as RegistroSemanal & {grupo_id?:string;turma_id?:string};
   // Nunca atribuir registro que pertence expressamente a outra turma.
   if(id(reg.turma_id) && id(reg.turma_id)!==id(turmaId))return false;
   if(id(reg.grupo_id))return false;
   return ids.includes(id(reg.matricula_id)) || (Boolean(reg.aluno_id)&&ids.includes(id(reg.aluno_id)));
 })};
}
