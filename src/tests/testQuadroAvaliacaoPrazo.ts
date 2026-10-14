import { strict as assert } from 'node:assert';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QuadroAvaliacaoPrazo from '../components/QuadroAvaliacaoPrazo';

const subs = [{ id: 's1', nome: 'Postura', maxPontos: 1, nota: 0.5 }, { id: 's2', nome: 'Técnica', maxPontos: 1, nota: 1 }];
const criterios: any[] = [
  { criterio_id: 'P', turma_id: 't', nome: 'Prova', nota_maxima: 2, ordem: 1, ativo: true },
  { criterio_id: 'R', turma_id: 't', nome: 'Rubrica', nota_maxima: 2, ordem: 2, ativo: true, tipo_calculo: 'rubric',
    subcriterios_json: JSON.stringify(subs), config_calculo_json: JSON.stringify({ agregacao: 'soma' }) },
  { criterio_id: 'F', turma_id: 't', nome: 'Futuro', nota_maxima: 2, ordem: 3, ativo: true },
];
const avaliacoes: any[] = [{ avaliacao_id: '1', matricula_id: 'm', criterio_id: 'P', nota: 1.8, observacao: 'Boa leitura' }];
const html = renderToStaticMarkup(createElement(QuadroAvaliacaoPrazo, { criterios, avaliacoes, ocorrencias: [
  { ocorrencia_id: 'o', matricula_id: 'm', data_hora: '', tipo: 'ATRASO', observacao: '' }] as any, matriculaId: 'm', turmaId: 't' }));
assert(html.includes('Avaliação até o prazo') && html.includes('Acumulado até o prazo'));
assert(html.includes('3,30'), 'acumulado = 1,80 + 1,50');
assert(html.includes('Ver critérios avaliados') && html.includes('Postura') && html.includes('Técnica'), 'subcritérios sob demanda');
assert(html.includes('Boa leitura'), 'observação preservada');
assert(html.includes('aguardando decisão') && html.includes('nenhum desconto'), 'ocorrência sem regra não desconta');
assert(!/média|previs|projeç/i.test(html.replace('percurso registrado', '')), 'sem média nem projeção');
console.log('[PASS] Quadro "Avaliação até o prazo": acumulado, subcritérios sob demanda e sem média/projeção.');
