import type { Aluno, Matricula } from '../types';

/** Somente matrículas confirmadas entram na chamada. Status vazio não é autorização para presumir presença. */
export const matriculaParticipaDaChamada = (status: unknown): boolean => {
  const s = String(status ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return ['MATRICULADO', 'MATRICULADA', 'ATIVO', 'ATIVA'].includes(s);
};

export function listarAlunosChamada(turmaId: string, matriculas: Matricula[], alunos: Aluno[]) {
  const codigo = (v: unknown) => String(v ?? '').trim();
  const alunosPorId = new Map(alunos.map(a => [codigo(a.aluno_id), a]));
  const alunosPorRa = new Map(alunos.filter(a => codigo(a.identificador_academico)).map(a => [codigo(a.identificador_academico), a]));
  const candidatos = matriculas.filter(m =>
    codigo(m.turma_id) === codigo(turmaId) && matriculaParticipaDaChamada(m.status)
  );
  const vistos = new Set<string>();
  return candidatos.map(m => {
    // Primeiro usar o vínculo canônico. Legados podem salvar RA no campo aluno_id.
    const a = alunosPorId.get(codigo(m.aluno_id)) || alunosPorRa.get(codigo(m.aluno_id));
    const id = codigo(m.matricula_id);
    if (!a || !id || vistos.has(id)) return null;
    vistos.add(id);
    return { matricula: m, aluno: a };
  }).filter((item): item is { matricula: Matricula; aluno: Aluno } => item !== null)
    .sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
}

/** Diagnóstico seguro: somente contagens, jamais imprime dados de alunos. */
export function diagnosticarChamada(turmaId: string, matriculas: Matricula[], alunos: Aluno[]) {
  const codigo = (v: unknown) => String(v ?? '').trim();
  const vinculadas = matriculas.filter(m => codigo(m.turma_id) === codigo(turmaId));
  const elegiveis = vinculadas.filter(m => matriculaParticipaDaChamada(m.status));
  return {
    matriculasNaTurma: vinculadas.length,
    matriculasElegiveis: elegiveis.length,
    alunosLocalizados: listarAlunosChamada(turmaId, matriculas, alunos).length,
    totalAlunosBase: alunos.length,
    totalMatriculasBase: matriculas.length,
  };
}

/** Lê células de Sheets em CSV simples, JSON array ou lista separada por quebra de linha. */
export function separarResponsaveis(value: unknown): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.flatMap(separarResponsaveis);
  const raw=String(value).trim();
  if (raw.startsWith('[')) {
    try { const v=JSON.parse(raw); if(Array.isArray(v)) return separarResponsaveis(v); } catch {}
  }
  return raw.split(/[;,\n]+/).map(v=>v.trim().replace(/^["']|["']$/g,'')).filter(Boolean);
}

export function resolverResponsaveis(params: {
 leitura: Record<string,unknown>;
 matriculas: Matricula[];
 alunos: Aluno[];
 grupos: {grupo_id:string;nome_grupo?:string}[];
 integrantes: {grupo_id:string;matricula_id?:string;aluno_id?:string;papel?:string}[];
}) {
  const {leitura, matriculas, alunos, grupos, integrantes}=params;
  const list: {matriculaId:string;nome:string;papel?:string;tipo:'TITULAR'|'SUBSTITUTO'|'GRUPO'}[]=[];
  const achar=(id:string)=>{
    const key=id.trim();
    const mat=matriculas.find(m=>String(m.matricula_id).trim()===key || String(m.aluno_id).trim()===key);
    const al=alunos.find(a=>String(a.aluno_id).trim()===String(mat?.aluno_id??key) || String(a.identificador_academico??'').trim()===key || a.nome.trim().toLocaleLowerCase('pt-BR')===key.toLocaleLowerCase('pt-BR'));
    return {mat,al};
  };
  const inserir=(rawId:string,tipo:'TITULAR'|'SUBSTITUTO'|'GRUPO',papel?:string)=>{
    const {mat,al}=achar(rawId);
    if(!al) return;
    const id=mat?.matricula_id ?? String(al.aluno_id);
    const found=list.find(x=>x.matriculaId===id);
    if(found) { if(tipo==='TITULAR') found.tipo='TITULAR'; return; }
    list.push({matriculaId:id,nome:al.nome,tipo,papel});
  };
  if(leitura.grupo_id && grupos.some(g=>g.grupo_id===leitura.grupo_id)) {
    integrantes.filter(i=>i.grupo_id===leitura.grupo_id).forEach(i=>inserir(String(i.matricula_id||i.aluno_id||''),'GRUPO',i.papel));
  }
  separarResponsaveis(leitura.responsaveis_previstos).forEach(id=>inserir(id,'TITULAR'));
  separarResponsaveis(leitura.responsaveis_efetivos).forEach(id=>inserir(id,'SUBSTITUTO'));
  separarResponsaveis(leitura.responsavel_id).forEach(id=>inserir(id,'TITULAR'));
  // Texto livre da planilha: exibir todos, mesmo sem matrícula vinculada.
  // Não usar texto livre como chave para alterações na base.
  const textos=separarResponsaveis(leitura.responsavel_nome || leitura.responsaveis_texto);
  for(const nome of textos) {
    if(list.some(x=>x.nome.trim().toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR'))) continue;
    const {mat,al}=achar(nome);
    if(al) inserir(mat?.matricula_id??al.aluno_id,'TITULAR');
    else list.push({matriculaId:'',nome,tipo:'TITULAR'});
  }
  return list;
}
