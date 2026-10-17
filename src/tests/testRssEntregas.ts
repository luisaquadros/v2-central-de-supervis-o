import { strict as assert } from 'node:assert';
import { resumirEntregasRss, contaComoEntrega, semanaExplicita, semanaPorData, aplicarAjustesRss, observacoesPorSemana, type AjusteRss } from '../services/rssEntregas';

const cron = [1, 2, 3, 4, 5, 6].map(n => ({ sequencia: n, semana_inicio: `2026-09-${String(n * 7 - 6 + 0).padStart(2, '0')}`, semana_fim: `2026-09-${String(n * 7).padStart(2, '0')}` }));
// semanas: 1 = 01–07/09, 2 = 08–14, 3 = 15–21, 4 = 22–28, 5 = 29/09..., ajusta 5 e 6 para outubro
cron[4] = { sequencia: 5, semana_inicio: '2026-09-29', semana_fim: '2026-10-05' };
cron[5] = { sequencia: 6, semana_inicio: '2026-10-06', semana_fim: '2026-10-12' };
const reg = (id: string, semana: unknown, data: string, extra: Record<string, unknown> = {}) => ({ registro_id: id, semana_rss: semana, status: 'RECEBIDO', status_revisao: 'VALIDADO', data_entrega: data, ...extra });
const base = { cronograma: cron, totalPrevisto: 12, hojeIso: '2026-10-13', esperadosAteHoje: 6 };

// 1) dois status; só semanas encerradas são exigíveis; total previsto no semestre
const r1 = resumirEntregasRss({ ...base, registros: [reg('a', 1, '2026-09-05'), reg('b', 2, '2026-09-12'), reg('c', 4, '2026-09-27')], realizadosConsolidado: 3 });
assert.deepEqual(r1.semanasEntregues, [1, 2, 4]);
assert.deepEqual(r1.semanasPendentes, [3, 5, 6]);
assert.equal(r1.totalRealizado, 3); assert.equal(r1.totalPrevisto, 12); assert.equal(r1.pendentesEmNumero, 3);
assert.deepEqual(r1.semanas.filter(s => s.status).map(s => s.status), ['ENTREGUE', 'ENTREGUE', 'NAO_ENTREGUE', 'ENTREGUE', 'NAO_ENTREGUE', 'NAO_ENTREGUE']);
assert(r1.semanas.slice(6).every(s => s.status === null && !s.exigivel), 'semanas futuras sem status');
assert(r1.semanas.every(s => s.status === null || s.status === 'ENTREGUE' || s.status === 'NAO_ENTREGUE'));

// 2) sem etapa de validação: PENDENTE_REVISAO com semana conta como entregue; FORA_ESCOPO não
const r2 = resumirEntregasRss({ ...base, registros: [reg('a', 3, '2026-09-20', { status_revisao: 'PENDENTE_REVISAO' }), reg('x', 5, '2026-10-01', { status: 'FORA_ESCOPO' })], realizadosConsolidado: 1 });
assert(r2.semanasEntregues.includes(3)); assert(!r2.semanasEntregues.includes(5));
assert.equal(contaComoEntrega({ status: 'ENTREGUE' }), true); assert.equal(contaComoEntrega({ status: 'FALTANTE' }), false);

// 3) identificação automática: semana vazia + data dentro do cronograma → semana pela data (sem ocupar semana já entregue)
const r3 = resumirEntregasRss({ ...base, registros: [reg('a', '', '2026-09-27'), reg('b', 4, '2026-09-26'), reg('c', '', '2026-09-13')], realizadosConsolidado: 3 });
assert.deepEqual(r3.semanasEntregues, [2, 4], 'c → semana 2 por data; a repete a semana 4 já entregue e fica sem semana');
assert.deepEqual(r3.semSemanaIdentificada, ['a']);
assert.equal(r3.semanas[1].origemSemana, 'DATA_ENTREGA');
// número do encontro nunca vira semana
assert.equal(semanaExplicita({ semana_rss: '', encontro_numero: 6 } as any), null);
assert.equal(semanaPorData({ data_entrega: '2026-12-31' }, cron), null, 'data fora do cronograma');
assert.equal(semanaPorData({ data_entrega: '' }, cron), null);

// 4) entrega sem semana identificada conta no total, mas nenhuma semana específica é acusada
const r4 = resumirEntregasRss({ ...base, registros: [reg('a', 1, '2026-09-05'), reg('s', '', '2026-12-31')], realizadosConsolidado: 2 });
assert.equal(r4.totalRealizado, 2); assert.equal(r4.semanasPendentes, null);
assert(r4.semanas.every(s => s.status !== 'NAO_ENTREGUE'), 'sem certeza de qual semana, ninguém é acusado');
assert.equal(r4.pendentesEmNumero, 4, 'mas a contagem de entregas faltantes continua exata');

// 5) consolidado maior que o detalhe: também não acusa semana específica
const r5 = resumirEntregasRss({ ...base, registros: [reg('a', 1, '2026-09-05')], realizadosConsolidado: 3 });
assert.equal(r5.totalRealizado, 3); assert.equal(r5.consolidadoSemDetalhe, 2); assert.equal(r5.semanasPendentes, null);

// 6) dados indisponíveis (erro de sincronização): jamais NAO_ENTREGUE
const r6 = resumirEntregasRss({ ...base, registros: [], realizadosConsolidado: 0, fonteDisponivel: false });
assert.equal(r6.disponibilidade, 'DADOS_INDISPONIVEIS'); assert.equal(r6.semanasPendentes, null);
assert(r6.semanas.every(s => s.status === null)); assert.equal(r6.pendentesEmNumero, 0);
// fonte ok e nada entregue: todas as exigíveis NAO_ENTREGUE (ausência real)
const r6b = resumirEntregasRss({ ...base, registros: [], realizadosConsolidado: 0 });
assert.deepEqual(r6b.semanasPendentes, [1, 2, 3, 4, 5, 6]);

// 7) atraso: só com data confiável, informativo (não muda status)
const r7 = resumirEntregasRss({ ...base, registros: [reg('a', 1, '2026-09-10'), reg('b', 2, '2026-09-12'), reg('c', 3, '')], realizadosConsolidado: 3 });
assert.deepEqual(r7.semanasAtrasadas, [1], 'semana 1 terminou em 07/09; entregue em 10/09');
assert.equal(r7.semanas[0].status, 'ENTREGUE'); assert.equal(r7.semanas[2].atrasada, false, 'sem data: sem juízo de atraso');

// 8) sem cronograma: usa 1..esperados
const r8 = resumirEntregasRss({ registros: [reg('a', 1, '2026-09-05')], cronograma: [], totalPrevisto: 12, esperadosAteHoje: 3, hojeIso: '2026-10-13', realizadosConsolidado: 1 });
assert.deepEqual(r8.semanasPendentes, [2, 3]);

// 9) duplicidade na mesma semana conta uma vez
const r9 = resumirEntregasRss({ ...base, registros: [reg('a', 2, '2026-09-10'), reg('b', 2, '2026-09-11')], realizadosConsolidado: 1 });
assert.deepEqual(r9.semanasEntregues, [2]); assert.equal(r9.totalRealizado, 1);
assert.equal(r9.semanas[1].registros.length, 2);

// 10) correção auditável de associação: aplica sobre cópias; fonte intacta; revogada não vale
const fonte = [reg('r1', '', '2026-12-31', { matricula_id: 'm1' }), reg('r2', 3, '2026-09-20', { matricula_id: 'outra' })];
const aj: AjusteRss[] = [
  { ajuste_id: 'a1', tipo: 'ASSOCIAR', registro_id: 'r1', turma_id: 't', semana: 4, semana_original: null, status: 'ATIVO', criado_em: 'x', criado_por: 'prof' },
  { ajuste_id: 'a2', tipo: 'ASSOCIAR', registro_id: 'r2', turma_id: 't', unidade_tipo: 'MATRICULA', unidade_id: 'm1', unidade_original_tipo: 'MATRICULA', unidade_original_id: 'outra', status: 'ATIVO', criado_em: 'x', criado_por: 'prof' },
  { ajuste_id: 'a3', tipo: 'ASSOCIAR', registro_id: 'r1', turma_id: 't', semana: 9, status: 'REVOGADO', criado_em: 'x', criado_por: 'prof' },
];
const copia = JSON.stringify(fonte);
const ajustados = aplicarAjustesRss(fonte as any[], aj);
assert.equal(JSON.stringify(fonte), copia, 'registros de origem intactos');
assert.equal((ajustados[0] as any).semana_rss, 4); assert.equal((ajustados[1] as any).matricula_id, 'm1');
const r10 = resumirEntregasRss({ ...base, registros: ajustados.filter((r: any) => r.matricula_id === 'm1') as any[], realizadosConsolidado: 2 });
assert.deepEqual(r10.semanasEntregues, [3, 4]); assert.equal(r10.semanas[3].origemSemana, 'AJUSTE');
assert.equal(aplicarAjustesRss(fonte as any[], []).length, 2);

// 11) observações pontuais por semana e unidade (não afetam status)
const obs: AjusteRss[] = [
  { ajuste_id: 'o1', tipo: 'OBSERVACAO', turma_id: 't', unidade_tipo: 'MATRICULA', unidade_id: 'm1', semana: 4, observacao: 'Entregou por e-mail.', status: 'ATIVO', criado_em: 'x', criado_por: 'prof' },
  { ajuste_id: 'o2', tipo: 'OBSERVACAO', turma_id: 't', unidade_tipo: 'MATRICULA', unidade_id: 'm2', semana: 4, observacao: 'de outra', status: 'ATIVO', criado_em: 'x', criado_por: 'prof' },
  { ajuste_id: 'o3', tipo: 'OBSERVACAO', turma_id: 't', unidade_tipo: 'MATRICULA', unidade_id: 'm1', semana: 2, observacao: 'revogada', status: 'REVOGADO', criado_em: 'x', criado_por: 'prof' },
];
const mapa = observacoesPorSemana(obs, 't', 'MATRICULA', 'm1');
assert.deepEqual(mapa.get(4), ['Entregou por e-mail.']); assert(!mapa.has(2));
const r11 = resumirEntregasRss({ ...base, registros: [reg('a', 4, '2026-09-27')], realizadosConsolidado: 1, observacoes: mapa });
assert.deepEqual(r11.semanas[3].observacoes, ['Entregou por e-mail.']); assert.equal(r11.semanas[3].status, 'ENTREGUE');

// 12) nada aqui calcula nota ou desconto
assert(!('nota' in r1) && !('desconto' in r1));
console.log('[PASS] RSS simplificado: dois status, semana automática, sem validação, sem acusar por dado ausente, atraso informativo e correção auditável.');
