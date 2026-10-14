import { strict as assert } from 'node:assert';
import {
  criarRubricaDocumentacao, validarRubrica, novaVersaoRubrica, aprovarRubrica, novoRascunho, selecionarNivel, ajustarPontuacao,
  comentarSubcriterio, subcriteriosParaEngine, pontuacaoSugerida, prepararConfirmacao, marcarConfirmada, subsidioDoGrupo,
  adotarSubsidio, descritorDoNivel, sugerirTipoEstagio, sugerirClassificacao, NIVEIS, type RubricaVersao,
} from '../services/rubricasAvaliacao';
import { calcularAvaliacao, type EntradaCriterio } from '../services/avaliacaoEngine';

const perto = (a: number | null, b: number, eps = 1e-9) => assert(a !== null && Math.abs(a - b) < eps, `${a} != ${b}`);
const T0 = '2026-10-14T10:00:00Z', T1 = '2026-10-14T11:00:00Z';
const nova = (tipo: any = 'CLINICA_ADULTO') => criarRubricaDocumentacao({ tipoEstagio: tipo, criterioId: 'CRIT-DOC', turmaId: 't1', periodoId: '2026.2', criadoPor: 'prof', agora: T0 });

// --- Estrutura: 6 subcritérios, pesos oficiais, total 2,5
const r = nova();
assert.equal(r.subcriterios.length, 6);
assert.deepEqual(r.subcriterios.map(s => s.peso), [0.65, 0.5, 0.45, 0.4, 0.3, 0.2]);
perto(r.peso_total, 2.5);
assert.deepEqual(validarRubrica(r, 2.5), []);
assert(validarRubrica(r, 2).some(p => p.codigo === 'SOMA_PESOS'));
assert.equal(r.status, 'aprovada');
assert.equal(r.versao, 1);
// descritor específico por nível e por subcritério (não genérico único)
for (const s of r.subcriterios) {
  for (const n of ['EXCELENTE', 'ADEQUADO', 'PARCIAL', 'INSUFICIENTE', 'NAO_ATENDIDO'] as const) assert(s.descritores[n] && s.descritores[n]!.length > 20, `${s.subcriterio_id}/${n}`);
  assert(new Set(Object.values(s.descritores)).size === 5, 'cinco descritores distintos');
}
assert.notEqual(r.subcriterios[0].descritores.EXCELENTE, r.subcriterios[1].descritores.EXCELENTE);
assert(r.subcriterios[0].foco.includes('Coerência do raciocínio profissional'));

// --- Adaptação por estágio (mesmos pesos; foco e descritores adaptados)
const adulto = nova('CLINICA_ADULTO'), ampl = nova('CLINICA_AMPLIADA'), org = nova('CONSULTORIA_ORGANIZACIONAL');
assert(adulto.subcriterios[0].foco.includes('Formulação e compreensão do caso'));
assert(ampl.subcriterios[0].foco.includes('Planejamento das ações'));
assert(ampl.subcriterios[1].foco.includes('Qualidade dos registros produzidos em grupo'));
assert(!ampl.subcriterios[0].foco.includes('Formulação e compreensão do caso'));
assert(/caso e do atendimento/.test(adulto.subcriterios[0].descritores.EXCELENTE!));
assert(/demandas do contexto/.test(ampl.subcriterios[0].descritores.EXCELENTE!));
assert.deepEqual(adulto.subcriterios.map(s => s.peso), ampl.subcriterios.map(s => s.peso));
// Consultoria: sem descritores clínicos; fica em rascunho até a professora definir
assert.equal(org.status, 'rascunho');
assert(org.subcriterios.every(s => Object.keys(s.descritores).length === 0));
assert(!JSON.stringify(org.subcriterios.map(s => [s.descritores, s.foco])).toLowerCase().includes('clínic'), 'sem foco/descritor clínico em atividade organizacional');
assert.equal(descritorDoNivel(org, 'DOC-ETICA', 'PARCIAL'), 'Descritor a definir pela professora para este tipo de estágio.');

// --- Níveis → pontuação (sugestão; não é nota oficial)
let rasc = novoRascunho({ rascunhoId: 'rs1', matriculaId: 'm1', escopo: 'INDIVIDUAL', rubrica: r, agora: T0, por: 'prof' });
assert.equal(pontuacaoSugerida(r, rasc).total, null, 'sem avaliação = null');
assert.equal(pontuacaoSugerida(r, rasc).parcial, null);
const nivelPorSub: Record<string, any> = { 'DOC-RACIOCINIO': 'EXCELENTE', 'DOC-REGISTROS': 'ADEQUADO', 'DOC-FUNDAMENTACAO': 'PARCIAL', 'DOC-ETICA': 'INSUFICIENTE', 'DOC-REGULARIDADE': 'NAO_ATENDIDO', 'DOC-ORGANIZACAO': 'EXCELENTE' };
for (const [sid, nv] of Object.entries(nivelPorSub)) rasc = selecionarNivel(rasc, sid, nv, 'prof', T0);
const esperado = 0.65 * 1 + 0.5 * 0.75 + 0.45 * 0.5 + 0.4 * 0.25 + 0.3 * 0 + 0.2 * 1;
perto(pontuacaoSugerida(r, rasc).total, esperado);
// incompleta: total null (não vira nota), parcial informativo
let inc = novoRascunho({ rascunhoId: 'rs2', matriculaId: 'm1', escopo: 'INDIVIDUAL', rubrica: r, agora: T0, por: 'prof' });
inc = selecionarNivel(inc, 'DOC-RACIOCINIO', 'EXCELENTE', 'prof', T0);
inc = selecionarNivel(inc, 'DOC-REGISTROS', 'NAO_AVALIADO', 'prof', T0);
assert.equal(pontuacaoSugerida(r, inc).total, null);
perto(pontuacaoSugerida(r, inc).parcial, 0.65);
assert.equal(prepararConfirmacao(r, inc, null).podeConfirmar, false);
assert.throws(() => selecionarNivel(rasc, 'DOC-INEXISTENTE', 'EXCELENTE', 'prof', T0));
assert.throws(() => selecionarNivel(rasc, 'DOC-ETICA', 'OUTRO' as any, 'prof', T0));
assert.deepEqual(NIVEIS.length, 6);

// --- Ajuste manual: justificativa obrigatória, limite do peso, histórico
assert.throws(() => ajustarPontuacao(rasc, 'DOC-ETICA', 0.3, '  ', 'prof', T1), /justificativa/i);
assert.throws(() => ajustarPontuacao(rasc, 'DOC-ETICA', 0.9, 'x', 'prof', T1), /entre 0 e/);
assert.throws(() => ajustarPontuacao(rasc, 'DOC-ETICA', NaN, 'x', 'prof', T1));
const ajustado = ajustarPontuacao(rasc, 'DOC-ETICA', 0.3, 'Sigilo exemplar no caso discutido em supervisão', 'prof', T1);
perto(pontuacaoSugerida(r, ajustado).total, esperado - 0.4 * 0.25 + 0.3);
const ev = ajustado.historico[ajustado.historico.length - 1];
assert.equal(ev.acao, 'AJUSTE'); assert.equal(ev.motivo, 'Sigilo exemplar no caso discutido em supervisão'); assert.equal(ev.depois, '0.3');
assert.equal(rasc.historico.length, 1 + 6, 'rascunho original imutável: criação + 6 níveis');
assert(comentarSubcriterio(ajustado, 'DOC-ETICA', 'Observação', 'prof', T1).selecoes.find(s => s.subcriterio_id === 'DOC-ETICA')!.ajuste, 'comentar preserva o ajuste');

// --- Engine: a prévia vem do rascunho; nota oficial não é alterada; divergência apenas sinalizada
const entrada = (oficial: unknown): EntradaCriterio => ({ disciplinaId: 'd', id: 'CRIT-DOC', nome: 'Documentação', tipo: 'hybrid', maxPontos: 2.5,
  subcriterios: subcriteriosParaEngine(r, rasc), config: { agregacao: 'soma' }, dados: { nota: oficial } });
const semOficial = calcularAvaliacao([entrada(undefined)]);
perto(semOficial.criterios[0].previa, esperado); assert.equal(semOficial.totalOficial, 0);
const comOficial = calcularAvaliacao([entrada(1.25)]);
perto(comOficial.totalOficial, 1.25); assert.equal(comOficial.divergencias.length, 1);
// rubrica não aprovada: confirmação bloqueada
assert.equal(prepararConfirmacao(org, novoRascunho({ rascunhoId: 'o', matriculaId: 'm', escopo: 'INDIVIDUAL', rubrica: org, agora: T0, por: 'p' }), null).podeConfirmar, false);

// --- Confirmação explícita
const conf = prepararConfirmacao(r, rasc, 1.25);
assert.equal(conf.podeConfirmar, true); assert.equal(conf.substituiOficial, true); perto(conf.diferenca, esperado - 1.25);
assert.equal(prepararConfirmacao(r, rasc, null).substituiOficial, false);
const confirmada = marcarConfirmada(rasc, 'prof', T1);
assert.equal(confirmada.status, 'CONFIRMADA');
assert.throws(() => selecionarNivel(confirmada, 'DOC-ETICA', 'PARCIAL', 'prof', T1), /confirmada/i);

// --- Versionamento: nova versão não altera retroativamente
const subsNovos = r.subcriterios.map(s => s.subcriterio_id === 'DOC-RACIOCINIO' ? { ...s, peso: 0.55 } : s.subcriterio_id === 'DOC-REGISTROS' ? { ...s, peso: 0.6 } : s);
assert.throws(() => novaVersaoRubrica(r, { subcriterios: subsNovos, criadoPor: 'prof', agora: T1, motivo: '', valorCriterio: 2.5 }), /motivo/i);
assert.throws(() => novaVersaoRubrica(r, { subcriterios: subsNovos.map(s => ({ ...s, peso: s.peso + 0.1 })), criadoPor: 'prof', agora: T1, motivo: 'm', valorCriterio: 2.5 }), /soma dos pesos/i);
const v2 = novaVersaoRubrica(r, { subcriterios: subsNovos, criadoPor: 'prof', agora: T1, motivo: 'Reequilíbrio pedagógico', valorCriterio: 2.5 });
assert.equal(v2.versao, 2); assert.equal(v2.status, 'rascunho'); assert.equal(r.versao, 1);
assert.equal(r.subcriterios[0].peso, 0.65, 'v1 imutável');
perto(pontuacaoSugerida(r, rasc).total, esperado);
const rascV1Em2 = pontuacaoSugerida(v2, rasc); // usa os pesos do snapshot do rascunho
perto(rascV1Em2.total, esperado, 1e-9);
assert.equal(rasc.rubrica_versao, 1); assert.equal(rasc.pesos['DOC-RACIOCINIO'], 0.65);
assert.equal(prepararConfirmacao(v2, rasc, null).podeConfirmar, false, 'v2 ainda não aprovada');
assert.equal(prepararConfirmacao(aprovarRubrica(v2, 'prof', T1), rasc, null).podeConfirmar, true);

// --- Documento coletivo: subsidia, não copia nota
const rAmpl = nova('CLINICA_AMPLIADA');
let grupo = novoRascunho({ rascunhoId: 'g1', matriculaId: 'grupo', grupoId: 'G1', escopo: 'COLETIVA', rubrica: rAmpl, agora: T0, por: 'prof' });
for (const s of rAmpl.subcriterios) grupo = selecionarNivel(grupo, s.subcriterio_id, 'ADEQUADO', 'prof', T0);
const ind = (id: string) => novoRascunho({ rascunhoId: id, matriculaId: id, escopo: 'INDIVIDUAL', rubrica: rAmpl, agora: T0, por: 'prof' });
let a = ind('mA'), b = ind('mB');
assert.equal(subsidioDoGrupo(grupo, 'mX', ['mA', 'mB']).length, 0, 'não integrante não recebe subsídio');
const sug = subsidioDoGrupo(grupo, 'mA', ['mA', 'mB']);
assert.equal(sug.length, 6); assert(sug.every(s => s.origem === 'grupo'));
assert.equal(a.selecoes.length, 0, 'nada é aplicado automaticamente');
assert.equal(pontuacaoSugerida(rAmpl, a).total, null);
a = adotarSubsidio(a, sug[0], 'prof', T1);
assert.equal(a.selecoes.length, 1); assert.equal(b.selecoes.length, 0, 'o outro integrante não muda');
for (const s of sug) a = adotarSubsidio(a, s, 'prof', T1);
a = selecionarNivel(a, 'DOC-REGULARIDADE', 'INSUFICIENTE', 'prof', T1); // diferenciação individual
b = selecionarNivel(b, 'DOC-REGULARIDADE', 'EXCELENTE', 'prof', T1);
assert.notEqual(a.selecoes.find(s => s.subcriterio_id === 'DOC-REGULARIDADE')!.nivel, b.selecoes.find(s => s.subcriterio_id === 'DOC-REGULARIDADE')!.nivel);
assert.throws(() => adotarSubsidio(grupo, sug[0], 'prof', T1), /individuais/i);
assert.throws(() => subsidioDoGrupo(a, 'mA', ['mA']), /coletivo/i);

// --- Sugestões por nome (nunca aplicadas) e classificação inicial D3
assert.equal(sugerirTipoEstagio('Clínica Ampliada — Matutino'), 'CLINICA_AMPLIADA');
assert.equal(sugerirTipoEstagio('Clínica Adulto — Estágio 1'), 'CLINICA_ADULTO');
assert.equal(sugerirTipoEstagio('Consultoria Organizacional — Estágio 3'), 'CONSULTORIA_ORGANIZACIONAL');
assert.equal(sugerirTipoEstagio('Qualquer coisa'), null);
assert.equal(sugerirClassificacao('Prova teórica')!.tipo, 'proportional');
assert.equal(sugerirClassificacao('Documentação da prática')!.tipo, 'hybrid');
assert.equal(sugerirClassificacao('Participação nas supervisões')!.tipo, 'continuous');
assert.equal(sugerirClassificacao('Assiduidade e pontualidade')!.tipo, 'hybrid');
assert.equal(sugerirClassificacao('Registros semanais'), null, 'registros semanais não viram critério por nome');

console.log('[PASS] Rubricas: pesos 2,5, níveis, descritores por estágio, ajuste justificado, versões, grupo→individual e confirmação.');
