import { strict as assert } from 'node:assert';
import { gerarRascunhoDevolutiva, contemTermoProibido, type EntradaDevolutiva } from '../services/devolutivaAvaliacao';
import { calcularAvaliacao, type EntradaCriterio } from '../services/avaliacaoEngine';
import { criarRubricaDocumentacao, novoRascunho, selecionarNivel, comentarSubcriterio } from '../services/rubricasAvaliacao';
import type { EvidenciaAvaliacao } from '../services/estruturaAvaliacao';

const T = '2026-10-14T10:00:00Z';
const rub = criarRubricaDocumentacao({ tipoEstagio: 'CLINICA_ADULTO', criterioId: 'CRIT-DOC', turmaId: 't1', periodoId: 'p1', criadoPor: 'prof', agora: T });
let rasc = novoRascunho({ rascunhoId: 'rs', matriculaId: 'm1', escopo: 'INDIVIDUAL', rubrica: rub, agora: T, por: 'prof' });
const niveis: Record<string, any> = { 'DOC-RACIOCINIO': 'EXCELENTE', 'DOC-REGISTROS': 'PARCIAL', 'DOC-FUNDAMENTACAO': 'ADEQUADO', 'DOC-ETICA': 'EXCELENTE', 'DOC-REGULARIDADE': 'INSUFICIENTE' };
for (const [id, n] of Object.entries(niveis)) rasc = selecionarNivel(rasc, id, n, 'prof', T); // DOC-ORGANIZACAO fica sem nível
rasc = comentarSubcriterio(rasc, 'DOC-REGISTROS', 'Faltou registrar a data da sessão 3.', 'prof', T);

const m = (id: string, nome: string, max: number, nota: number | null): EntradaCriterio => ({ disciplinaId: 'd', id, nome, tipo: 'manual', maxPontos: max, dados: { nota } });
const resultado = calcularAvaliacao([m('prova', 'Prova teórica', 2, 1.0), m('intro', 'Introdução do relatório', 1, 1.0), m('final', 'Relatório final', 2, null), m('doc', 'Documentação', 2.5, 1.25),
  m('sem', 'Seminário', 0.5, 0.04166666666666667), m('part', 'Participação', 0.8, 0.4), m('desemp', 'Desempenho', 1, 0.5), m('assid', 'Assiduidade', 0.2, 0.1)]);

const ev = (id: string, polaridade: any, observacao: string, extra: Partial<EvidenciaAvaliacao> = {}): EvidenciaAvaliacao => ({ evidencia_id: id, periodo_id: 'p1', turma_id: 't1', matricula_id: 'm1',
  data: '2026-10-09', origem: 'SUPERVISAO', polaridade, observacao, responsavel: 'prof', preliminar: false, criado_em: T, atualizado_em: T, ...extra });
const base = (extra: Partial<EntradaDevolutiva> = {}): EntradaDevolutiva => ({ resultado, rubrica: rub, rascunho: rasc, geradoEm: T, temRegistroParticipacao: false,
  rss: { realizados: 2, esperadosAteOPrazo: 6, totalPrevisto: 12, semanaAtual: 6 },
  documentos: [{ nome: 'Termo de compromisso', situacao: 'PENDENTE' }, { nome: 'Manual de estágio', situacao: 'A_CONFERIR' }],
  evidencias: [ev('e1', 'POSITIVO', 'Relacionou a hipótese do caso ao referencial na supervisão de 09/10.'), ev('e2', 'DESENVOLVER', 'Trouxe o caso sem a síntese dos atendimentos anteriores.'),
    ev('p1', 'POSITIVO', 'PRELIMINAR-DA-MONITORA organizou bem os arquivos.', { origem: 'CONTRIBUICAO_MONITORA', preliminar: true }), ev('v1', 'POSITIVO', '   ')], ...extra });

const d = gerarRascunhoDevolutiva(base());
const sec = (id: string) => d.secoes.find(s => s.id === id)!.itens.map(i => i.texto).join('\n');
assert.equal(d.status, 'RASCUNHO');

// notas oficiais (fatos), sem média/projeção
assert(sec('notas').includes('Prova teórica: 1,00 de 2,00.'));
assert(sec('notas').includes('Relatório final: ainda não avaliado nesta etapa.'), 'null não vira zero');
assert(sec('notas').includes('Acumulado oficial até o prazo: 4,29 de 10,00') && sec('notas').includes('não corresponde à nota final'));
// rubrica: descritores específicos por nível
assert(sec('fortes').includes('Raciocínio técnico e clínico (excelente):') && sec('fortes').includes('justifica as decisões técnicas com coerência e autonomia'));
assert(sec('fortes').includes('Fundamentação técnico-científica (adequado)'));
assert(sec('desenvolvimento').includes('Qualidade e suficiência dos registros (parcial)') && sec('desenvolvimento').includes('Faltou registrar a data da sessão 3.'), 'comentário da professora preservado');
assert(sec('aprimoramento').includes('Regularidade e cumprimento de prazos (insuficiente)'));
assert(sec('desenvolvimento').includes('Organização e clareza: informação insuficiente'), 'sem nível = informação insuficiente');
assert(d.complementar.some(c => c.includes('Organização e clareza')));
// recomendações derivadas do foco da rubrica
assert(sec('recomendacoes').includes('Qualidade e suficiência dos registros: reveja Completude; Objetividade; Relevância'));
assert(!sec('recomendacoes').includes('Raciocínio técnico e clínico'), 'excelente não gera recomendação');
// evidências: usadas as da professora; monitora só se aprovada; vazia ignorada
assert(sec('fortes').includes('Relacionou a hipótese do caso ao referencial'));
assert(sec('aprimoramento').includes('sem a síntese dos atendimentos anteriores'));
assert(!d.texto.includes('PRELIMINAR-DA-MONITORA'), 'preliminar fora por padrão');
const comMon = gerarRascunhoDevolutiva(base({ preliminaresAprovadas: new Set(['p1']) }));
assert(comMon.texto.includes('PRELIMINAR-DA-MONITORA'), 'usada quando a professora aprova');
// registros semanais: atraso mensurável + compromisso com data a definir
assert(sec('aprimoramento').includes('constam 2 de 6 esperados até o prazo (12 previstos no semestre)') && sec('aprimoramento').includes('Há atraso'));
assert(sec('proximos').includes('Enviar os 4 registro(s)') && sec('proximos').includes('[definir data com a professora]'));
assert(d.complementar.includes('Definir a data do compromisso de envio dos registros pendentes.'));
// documentos: pendente ≠ a conferir
assert(sec('proximos').includes('Entregar: Termo de compromisso.'));
assert(!d.texto.includes('Manual de estágio: entrega pendente') && d.complementar.some(c => c.includes('Manual de estágio')));
// participação: ausência de registro não é conduta
assert(sec('aprimoramento').includes('Não constam registros de participação nas supervisões'));
assert(d.complementar.some(c => c.includes('participação')));
assert(!gerarRascunhoDevolutiva(base({ temRegistroParticipacao: true })).texto.includes('Não constam registros de participação'));
// fontes em todos os itens
for (const s of d.secoes) for (const i of s.itens) assert(i.fontes.length > 0 && i.fontes.every(f => f.length > 3), `${s.id}: item sem fonte`);
// sem termos proibidos, sem média/projeção, sem nome
assert.equal(contemTermoProibido(d.texto), false);
assert(!/m[eé]dia|proje[cç]/i.test(d.texto.replace('não corresponde à nota final', '')));
assert.equal(contemTermoProibido('O aluno tem personalidade difícil'), true);
// determinístico
assert.equal(gerarRascunhoDevolutiva(base()).texto, d.texto);
// em dia: registros viram ponto forte, sem atraso nem compromisso
const emDia = gerarRascunhoDevolutiva(base({ rss: { realizados: 6, esperadosAteOPrazo: 6, totalPrevisto: 12 } }));
assert(!emDia.texto.includes('Há atraso') && emDia.texto.includes('constam 6 de 6'));
// dados insuficientes: nada inventado
const vazio = gerarRascunhoDevolutiva({ resultado: calcularAvaliacao([]), evidencias: [], geradoEm: T, rss: null, temRegistroParticipacao: null });
assert(vazio.complementar.some(c => c.includes('rubrica')) && vazio.complementar.some(c => c.includes('evidência')) && vazio.complementar.some(c => c.includes('registros semanais')));
assert(vazio.texto.includes('Sem registros suficientes para esta seção.'));
assert(!vazio.secoes.find(s => s.id === 'fortes')!.itens.length, 'nenhum elogio sem evidência');
// grupo (ampliada)
assert(gerarRascunhoDevolutiva(base({ rss: { realizados: 1, esperadosAteOPrazo: 3, totalPrevisto: 12, unidade: 'GRUPO' } })).texto.includes('enviados pelo grupo'));
// nota inválida na base é sinalizada, não escondida
const invalida = calcularAvaliacao([m('x', 'Prova teórica', 2, null), { ...m('y', 'Documentação', 2.5, null), dados: { nota: 'abc' } }]);
const dInv = gerarRascunhoDevolutiva({ ...base(), resultado: invalida });
assert(dInv.complementar.some(c => c.includes('Documentação') && c.includes('inválido')));
console.log('[PASS] Devolutiva: determinística, com fonte em cada item, sem IA, sem média/projeção, sem elogio sem evidência e com complementações.');
