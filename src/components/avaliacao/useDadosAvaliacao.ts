import { useMemo } from 'react';
import { useSupervisao } from '../../context/SupervisaoContext';
import {
  linhaParaConfig, linhaParaRubrica, linhaParaRascunho, linhaParaEvidencia,
  type ConfigAvaliacao, type EvidenciaAvaliacao,
} from '../../services/estruturaAvaliacao';
import type { RascunhoAvaliacao, RubricaVersao } from '../../services/rubricasAvaliacao';

/** Converte as linhas brutas das abas aditivas em domínio; linhas inválidas são contadas, nunca descartadas em silêncio. */
export function useDadosAvaliacao(turmaId: string, periodoId: string) {
  const { configAvaliacao, rubricasAvaliacao, rascunhosAvaliacao, evidenciasAvaliacao } = useSupervisao();
  return useMemo(() => {
    let invalidas = 0;
    const configs: ConfigAvaliacao[] = [];
    for (const l of configAvaliacao) { const r = linhaParaConfig(l); if (r.config) configs.push(r.config); else invalidas++; }
    const rubricas: RubricaVersao[] = [];
    for (const l of rubricasAvaliacao) { const r = linhaParaRubrica(l); if (r.rubrica) rubricas.push(r.rubrica); else invalidas++; }
    const rascunhos: RascunhoAvaliacao[] = [];
    for (const l of rascunhosAvaliacao) { const r = linhaParaRascunho(l); if (r.rascunho) rascunhos.push(r.rascunho); else invalidas++; }
    const evidencias: EvidenciaAvaliacao[] = evidenciasAvaliacao.map(linhaParaEvidencia);
    return {
      configs: configs.filter(c => c.turma_id === turmaId && (!periodoId || c.periodo_id === periodoId)),
      rubricas: rubricas.filter(r => r.turma_id === turmaId && (!periodoId || r.periodo_id === periodoId)),
      rascunhos,
      evidencias: evidencias.filter(e => e.turma_id === turmaId),
      linhasInvalidas: invalidas,
    };
  }, [configAvaliacao, rubricasAvaliacao, rascunhosAvaliacao, evidenciasAvaliacao, turmaId, periodoId]);
}

/** Mensagem amigável: aba da avaliação ainda não criada na planilha → orienta onde criar. */
export function mensagemErroAvaliacao(e: unknown, padrao = 'Não foi possível salvar.'): string {
  const m = e instanceof Error ? e.message : '';
  if (/cabe[cç]alho|SCHEMA_MISMATCH|not found|Unable to parse range/i.test(m)) {
    return 'A estrutura da avaliação ainda não existe na planilha. Crie-a em Configurações → Estrutura da avaliação.';
  }
  return m || padrao;
}
