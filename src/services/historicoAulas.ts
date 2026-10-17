import type { EncontroTurma, HorarioTurma } from '../types';

/** Datas oficiais sugeridas, preservando encontros extraordinários registrados.
 * Não cria chamadas nem atribui presenças; feriados permanecem visíveis com situação.
 */
export function listarDatasSupervisao(turmaId: string, horarios: HorarioTurma[], encontros: EncontroTurma[],
  dataInicio: string, dataFim: string, hoje: string): {data:string; situacao:string}[] {
  const iso = (d:string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const inicio = iso(dataInicio) ? dataInicio : hoje.slice(0,4)+'-08-01';
  const fim = iso(dataFim) ? (dataFim < hoje ? dataFim : hoje) : hoje;
  const h = horarios.filter(x=>x.turma_id===turmaId && x.ativo);
  const valores=new Map<string,string>();
  const dt = (v:string) => new Date(v+'T12:00:00Z');
  const i=dt(inicio),final=dt(fim);
  // Evita loops longos caso o calendário venha malformado.
  if(!Number.isFinite(i.getTime()) || !Number.isFinite(final.getTime())) return [];
  for(let t=i.getTime(),n=0;t<=final.getTime()&&n<210;t+=86400000,n++){
    const data=new Date(t).toISOString().slice(0,10);
    if(h.some(x=>x.dia_semana===new Date(t).getUTCDay() &&
      (!x.data_inicio || x.data_inicio<=data) && (!x.data_fim || x.data_fim>=data)))
      valores.set(data,'Programada');
  }
  for(const e of encontros.filter(x=>x.turma_id===turmaId && iso(x.data) && x.data<=hoje))
    valores.set(e.data,e.status==='NAO_REALIZADO'?'Não realizada':
      e.status==='REAGENDADO'?'Reagendada':'Registrada');
  return [...valores].sort(([a],[b])=>a.localeCompare(b)).map(([data,situacao])=>({data,situacao}));
}
