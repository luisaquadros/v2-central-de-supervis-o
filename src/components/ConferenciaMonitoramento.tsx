import React from 'react';
import { CheckCircle2, ListChecks, TriangleAlert } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { diagnosticarMonitoramento } from '../services/monitoramentoDocumentosService';
import { temSupervisaoHorarioAlternativo, ROTULO_HORARIO_ALTERNATIVO } from '../services/condicoesMatricula';

/** Conferência somente leitura, feita no navegador, dos vínculos da aba monitoramento_documentos e da condição de horário alternativo. */
export const ConferenciaMonitoramento: React.FC = () => {
  const { monitoramentoDocumentos, matriculas, gruposPratica, alunos, turmas } = useSupervisao();
  const problemas = diagnosticarMonitoramento(monitoramentoDocumentos, { matriculas, grupos: gruposPratica });
  const erros = problemas.filter(p => p.nivel === 'ERRO'), avisos = problemas.filter(p => p.nivel === 'AVISO');
  const alternativas = matriculas.filter(temSupervisaoHorarioAlternativo);
  const nome = (alunoId: string) => alunos.find(a => a.aluno_id === alunoId)?.nome ?? alunoId;
  const turma = (id: string) => turmas.find(t => t.turma_id === id)?.nome ?? id;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-2" data-testid="conferencia-monitoramento">
      <div className="flex items-center gap-2 font-bold text-slate-900 text-sm"><ListChecks className="w-4 h-4 text-slate-500" /> Conferência de documentos e horário alternativo</div>
      <p className="text-slate-500">Leitura apenas: confere se cada linha de <code>monitoramento_documentos</code> aponta para uma matrícula ou grupo existente (por ID, nunca por nome) e lista as matrículas marcadas em <code>papel_na_turma</code>.</p>
      <p className="flex items-center gap-1.5">{erros.length === 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <TriangleAlert className="w-4 h-4 text-red-600" />}
        <span>{monitoramentoDocumentos.length} linha(s) lida(s) · {erros.length} erro(s) · {avisos.length} aviso(s)</span></p>
      {[...erros, ...avisos].slice(0, 12).map((p, i) => <p key={i} className={p.nivel === 'ERRO' ? 'text-red-800' : 'text-amber-800'}>• {p.texto}</p>)}
      <div>
        <p className="font-semibold text-slate-800">{ROTULO_HORARIO_ALTERNATIVO}: {alternativas.length} matrícula(s)</p>
        {alternativas.map(m => <p key={m.matricula_id} className="text-slate-600">• {nome(m.aluno_id)} — {turma(m.turma_id)}</p>)}
      </div>
    </div>
  );
};
