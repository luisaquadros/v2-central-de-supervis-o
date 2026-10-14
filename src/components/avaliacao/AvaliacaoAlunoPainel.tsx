import { useMemo, useState, type ReactNode } from 'react';
import { useSupervisao } from '../../context/SupervisaoContext';
import type { Aluno, Avaliacao, CriterioAvaliacao, Documento, Ocorrencia, Turma } from '../../types';
import { selecionarCriteriosAplicaveis } from '../../services/avaliacaoAdaptador';
import { configPorCriterioDoAluno } from '../../services/estruturaAvaliacao';
import { useDadosAvaliacao } from './useDadosAvaliacao';
import ResumoAvaliacao from './ResumoAvaliacao';
import EvidenciasPainel from './EvidenciasPainel';
import RubricasPainel from './RubricasPainel';
import DevolutivaPainel from './DevolutivaPainel';

type Secao = 'resumo' | 'evidencias' | 'rubricas' | 'devolutiva';
const SECOES: Array<{ id: Secao; rotulo: string }> = [
  { id: 'resumo', rotulo: 'Resumo' }, { id: 'evidencias', rotulo: 'Evidências' }, { id: 'rubricas', rotulo: 'Rubricas' }, { id: 'devolutiva', rotulo: 'Devolutiva' },
];

interface Props {
  aluno: Aluno; turma: Turma; matriculaId: string; periodoId: string; grupoId?: string;
  criterios: CriterioAvaliacao[]; avaliacoes: Avaliacao[]; ocorrencias: Ocorrencia[]; documentos: Documento[];
  /** edição manual das notas oficiais já existente (mantida) */
  children?: ReactNode;
}

/** Avaliação formativa da ficha: Resumo · Evidências · Rubricas · Devolutiva. Reaproveita a edição manual de notas já existente. */
export default function AvaliacaoAlunoPainel(p: Props) {
  const { currentUser, getSituacaoRssEstudante } = useSupervisao();
  const [secao, setSecao] = useState<Secao>('resumo');
  const dados = useDadosAvaliacao(p.turma.turma_id, p.periodoId);
  const aplicaveis = useMemo(() => selecionarCriteriosAplicaveis(p.criterios, { turmaId: p.turma.turma_id, disciplinaId: p.turma.disciplina_id }), [p.criterios, p.turma]);
  const configPorCriterio = useMemo(() => configPorCriterioDoAluno({ configs: dados.configs, rubricas: dados.rubricas, rascunhos: dados.rascunhos, turmaId: p.turma.turma_id,
    periodoId: p.periodoId, criterioIds: aplicaveis.map(c => c.criterio_id), matriculaId: p.matriculaId }), [dados, aplicaveis, p.turma, p.periodoId, p.matriculaId]);
  const email = currentUser?.email ?? '';
  const rss = getSituacaoRssEstudante(p.matriculaId);
  const pendenciasDocumentos = p.documentos.filter(d => d.matricula_id === p.matriculaId && d.status === 'PENDENTE').map(d => `Documento pendente: ${d.tipo}`);

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Seções da avaliação" className="flex overflow-x-auto rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
        {SECOES.map(s => (
          <button key={s.id} role="tab" aria-selected={secao === s.id} onClick={() => setSecao(s.id)}
            className={`min-h-[44px] flex-1 whitespace-nowrap rounded-md px-3 font-semibold ${secao === s.id ? 'bg-slate-800 text-white' : 'text-slate-700'}`}>{s.rotulo}</button>
        ))}
      </div>
      {dados.linhasInvalidas > 0 && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-800">{dados.linhasInvalidas} linha(s) das abas de avaliação estão com conteúdo inválido e foram ignoradas; confira na planilha.</p>}

      {secao === 'resumo' && (
        <div className="space-y-4">
          <ResumoAvaliacao criterios={p.criterios} avaliacoes={p.avaliacoes} ocorrencias={p.ocorrencias} evidencias={dados.evidencias} matriculaId={p.matriculaId}
            turmaId={p.turma.turma_id} disciplinaId={p.turma.disciplina_id} configPorCriterio={configPorCriterio}
            rss={rss ? { realizados: rss.registrosRealizados, esperados: rss.registrosEsperadosAteHoje, total: rss.totalPrevistoNoPeriodo } : null}
            pendenciasDocumentos={pendenciasDocumentos} irParaRubricas={() => setSecao('rubricas')} />
          {p.children}
        </div>
      )}
      {secao === 'evidencias' && <EvidenciasPainel evidencias={dados.evidencias} matriculaId={p.matriculaId} turmaId={p.turma.turma_id} periodoId={p.periodoId} criterios={aplicaveis} emailProfessora={email} />}
      {secao === 'rubricas' && <RubricasPainel criterios={aplicaveis} configs={dados.configs} rubricas={dados.rubricas} rascunhos={dados.rascunhos} oficiais={p.avaliacoes}
        matriculaId={p.matriculaId} turmaId={p.turma.turma_id} turmaNome={p.turma.nome} periodoId={p.periodoId} grupoId={p.grupoId} emailProfessora={email} />}
      {secao === 'devolutiva' && <DevolutivaPainel aluno={p.aluno} turma={p.turma} matriculaId={p.matriculaId} periodoId={p.periodoId} criterios={p.criterios} avaliacoes={p.avaliacoes}
        ocorrencias={p.ocorrencias} documentos={p.documentos} configs={dados.configs} rubricas={dados.rubricas} rascunhos={dados.rascunhos} evidencias={dados.evidencias} />}
    </div>
  );
}
