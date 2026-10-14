import { useMemo, useState, useId, type ReactNode } from 'react';
import { useSupervisao } from '../../context/SupervisaoContext';
import type { Aluno, Avaliacao, CriterioAvaliacao, Documento, Ocorrencia, Turma } from '../../types';
import { selecionarCriteriosAplicaveis } from '../../services/avaliacaoAdaptador';
import { configPorCriterioDoAluno } from '../../services/estruturaAvaliacao';
import { useDadosAvaliacao } from './useDadosAvaliacao';
import ResumoAvaliacao from './ResumoAvaliacao';
import EvidenciasPainel from './EvidenciasPainel';
import RubricasPainel from './RubricasPainel';
import DevolutivaPainel from './DevolutivaPainel';

type Secao = 'resumo' | 'evidencias' | 'pareceres' | 'rubricas' | 'devolutiva';
const SECOES: Array<{ id: Secao; rotulo: string }> = [
  { id: 'resumo', rotulo: 'Resumo' }, { id: 'evidencias', rotulo: 'Evidências' }, { id: 'pareceres', rotulo: 'Pareceres' }, { id: 'rubricas', rotulo: 'Rubricas' }, { id: 'devolutiva', rotulo: 'Devolutiva' },
];

interface Props {
  aluno: Aluno; turma: Turma; matriculaId: string; periodoId: string; grupoId?: string;
  criterios: CriterioAvaliacao[]; avaliacoes: Avaliacao[]; ocorrencias: Ocorrencia[]; documentos: Documento[];
  /** edição manual das notas oficiais já existente (mantida) */
  children?: ReactNode;
  secaoInicial?: Secao;
}

/** Avaliação formativa da ficha: Resumo · Evidências · Rubricas · Devolutiva. Reaproveita a edição manual de notas já existente. */
export default function AvaliacaoAlunoPainel(p: Props) {
  const { currentUser, getSituacaoRssEstudante } = useSupervisao();
  const [secao, setSecao] = useState<Secao>(p.secaoInicial ?? 'resumo');
  const painelId = useId();
  const dados = useDadosAvaliacao(p.turma.turma_id, p.periodoId);
  const aplicaveis = useMemo(() => selecionarCriteriosAplicaveis(p.criterios, { turmaId: p.turma.turma_id, disciplinaId: p.turma.disciplina_id }), [p.criterios, p.turma]);
  const configPorCriterio = useMemo(() => configPorCriterioDoAluno({ configs: dados.configs, rubricas: dados.rubricas, rascunhos: dados.rascunhos, turmaId: p.turma.turma_id,
    periodoId: p.periodoId, criterioIds: aplicaveis.map(c => c.criterio_id), matriculaId: p.matriculaId }), [dados, aplicaveis, p.turma, p.periodoId, p.matriculaId]);
  const email = currentUser?.email ?? '';
  const rss = getSituacaoRssEstudante(p.matriculaId);
  const pendenciasDocumentos = p.documentos.filter(d => d.matricula_id === p.matriculaId && d.status === 'PENDENTE').map(d => `Documento pendente: ${d.tipo}`);

  return (
    <div className="prisma-avaliacao space-y-4">
      <div role="tablist" aria-label="Seções da avaliação" className="grid grid-cols-2 sm:grid-cols-5 gap-1 rounded-lg border border-slate-300 bg-white p-1 text-sm">
        {SECOES.map(s => (
          <button key={s.id} role="tab" id={`${painelId}-${s.id}`} aria-controls={`${painelId}-painel`} tabIndex={secao === s.id ? 0 : -1} aria-selected={secao === s.id} onKeyDown={e => {
              const i = SECOES.findIndex(x => x.id === s.id);
              const j = e.key === 'ArrowRight' ? (i + 1) % SECOES.length : e.key === 'ArrowLeft' ? (i + SECOES.length - 1) % SECOES.length : e.key === 'Home' ? 0 : e.key === 'End' ? SECOES.length - 1 : null;
              if (j !== null) { e.preventDefault(); setSecao(SECOES[j].id); document.getElementById(`${painelId}-${SECOES[j].id}`)?.focus(); }
            }} onClick={() => setSecao(s.id)}
            className={`min-h-[44px]! min-w-0 rounded-md px-3 font-semibold ${secao === s.id ? 'cs-primary-action text-white' : 'text-slate-700'}`}>{s.rotulo}</button>
        ))}
      </div>
      {dados.linhasInvalidas > 0 && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-800">{dados.linhasInvalidas} linha(s) das abas de avaliação estão com conteúdo inválido e foram ignoradas; confira na planilha.</p>}

      <div role="tabpanel" id={`${painelId}-painel`} aria-labelledby={`${painelId}-${secao}`}>
      {secao === 'resumo' && (
        <div className="space-y-4">
          <ResumoAvaliacao criterios={p.criterios} avaliacoes={p.avaliacoes} ocorrencias={p.ocorrencias} evidencias={dados.evidencias} matriculaId={p.matriculaId}
            turmaId={p.turma.turma_id} disciplinaId={p.turma.disciplina_id} configPorCriterio={configPorCriterio}
            rss={rss ? { realizados: rss.registrosRealizados, esperados: rss.registrosEsperadosAteHoje, total: rss.totalPrevistoNoPeriodo } : null}
            pendenciasDocumentos={pendenciasDocumentos} irParaRubricas={() => setSecao('rubricas')} />
          {p.children && <details className="prisma-section"><summary>Notas oficiais · professora</summary><p className="prisma-meta">Edição pelos critérios existentes. Revise antes de confirmar.</p>{p.children}</details>}
        </div>
      )}
      {secao === 'evidencias' && <EvidenciasPainel evidencias={dados.evidencias} matriculaId={p.matriculaId} turmaId={p.turma.turma_id} periodoId={p.periodoId} criterios={aplicaveis} emailProfessora={email} />}
      {secao === 'pareceres' && <section className="cs-panel p-4 space-y-3" aria-label="Pareceres preliminares">
        <h3 className="prisma-title text-xl">Pareceres das monitoras</h3>
        <p className="prisma-meta">Contribuições preliminares. A decisão acadêmica cabe à professora.</p>
        {!dados.evidencias.some(e => e.matricula_id === p.matriculaId && e.origem === 'CONTRIBUICAO_MONITORA') && <p className="prisma-meta">Nenhum parecer disponível para esta matrícula.</p>}
        <ul className="divide-y">{dados.evidencias.filter(e => e.matricula_id === p.matriculaId && e.origem === 'CONTRIBUICAO_MONITORA').map(e => <li key={e.evidencia_id} className="py-3 space-y-1">
          <p className="font-semibold">{e.polaridade === 'POSITIVO' ? 'Ponto positivo' : e.polaridade === 'DESENVOLVER' ? 'Aspecto a melhorar' : 'Observação'}</p>
          <p className="break-words">{e.observacao}</p><p className="prisma-meta">{e.preliminar ? 'Preliminar' : 'Registrado'} · não equivale a nota</p>
        </li>)}</ul>
      </section>}
      {secao === 'rubricas' && <RubricasPainel criterios={aplicaveis} configs={dados.configs} rubricas={dados.rubricas} rascunhos={dados.rascunhos} oficiais={p.avaliacoes}
        matriculaId={p.matriculaId} turmaId={p.turma.turma_id} turmaNome={p.turma.nome} periodoId={p.periodoId} grupoId={p.grupoId} emailProfessora={email} />}
      {secao === 'devolutiva' && <DevolutivaPainel aluno={p.aluno} turma={p.turma} matriculaId={p.matriculaId} periodoId={p.periodoId} criterios={p.criterios} avaliacoes={p.avaliacoes}
        ocorrencias={p.ocorrencias} documentos={p.documentos} configs={dados.configs} rubricas={dados.rubricas} rascunhos={dados.rascunhos} evidencias={dados.evidencias} />}
      </div>
    </div>
  );
}
