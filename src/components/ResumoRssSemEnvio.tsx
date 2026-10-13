import React from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { calcularMetricasCronogramaRss, getHojeDataIso } from '../services/supervisaoOperacionalService';
import { resumirSemEnvioRss, type UnidadeRssRef } from '../services/sugestoesAulaService';

/**
 * Resumo do RSS da semana: quantos alunos (ou grupos) NÃO enviaram o registro nos últimos 7 dias.
 * É informação de consulta (turma, Preparar aula e Modo Aula): não gera pendência nem notificação.
 */
export const ResumoRssSemEnvio: React.FC<{ turmaId: string; compacto?: boolean }> = ({ turmaId, compacto = false }) => {
  const { registrosSemanais, gruposPratica, getAlunosDaTurma, calendarioRss, situacaoAtualTurmas } = useSupervisao();
  const hojeIso = getHojeDataIso();
  const grupos = gruposPratica.filter(g => g.turma_id === turmaId);
  const unidades: UnidadeRssRef[] = grupos.length
    ? grupos.map(g => ({ unidadeId: g.grupo_id, tipo: 'GRUPO' as const, nome: g.nome_grupo || 'Grupo' }))
    : getAlunosDaTurma(turmaId).map(a => ({ unidadeId: a.matricula.matricula_id, tipo: 'INDIVIDUAL' as const, nome: a.aluno.nome }));
  const praticaAtiva = calcularMetricasCronogramaRss(turmaId, calendarioRss, situacaoAtualTurmas, hojeIso).semanaAtual !== null;
  const resumo = resumirSemEnvioRss({ turmaId, registros: registrosSemanais, unidades, hojeIso, praticaAtiva });
  if (!resumo) return null;

  const tudoCerto = resumo.semEnvio === 0;
  return (
    <div data-testid="resumo-rss-sem-envio"
      className={`rounded-xl border ${compacto ? 'px-3 py-2' : 'p-3.5'} text-sm ${tudoCerto ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900' : 'border-amber-200 bg-amber-50/50 text-amber-900'}`}>
      <div className="flex items-center gap-2 font-semibold">
        {tudoCerto ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <FileText className="w-4 h-4 text-amber-600 shrink-0" />}
        <span>RSS da semana: {resumo.texto}</span>
      </div>
      {!tudoCerto && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-slate-600 min-h-[28px] flex items-center">Ver {resumo.tipo === 'GRUPO' ? 'quais grupos' : 'quais alunos'}</summary>
          <p className="text-xs text-slate-700 leading-relaxed">{resumo.nomes.join(', ')}</p>
        </details>
      )}
    </div>
  );
};
