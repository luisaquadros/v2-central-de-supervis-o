import { strict as assert } from 'node:assert';
import { situacaoEfetiva, normalizarMonitoramento, documentosDaTurma, documentosDoEstudante, documentosDoGrupo, resumirMonitoramento, diagnosticarMonitoramento, titularTipoDe, AVISO_MODIFICACAO } from '../services/monitoramentoDocumentosService';
import { condicoesDaMatricula, temSupervisaoHorarioAlternativo, geraRegistroAutomatico } from '../services/condicoesMatricula';

const agora = new Date('2026-10-13T12:00:00Z');
const dia = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();

// ---- situação: recência pela data, sem confundir com entrega ----
assert.equal(situacaoEfetiva({ status: 'LOCALIZADO_RECENTE', data_modificacao_drive: dia(3) }, agora), 'LOCALIZADO_RECENTE');
assert.equal(situacaoEfetiva({ status: 'LOCALIZADO_RECENTE', data_modificacao_drive: dia(8) }, agora), 'LOCALIZADO_ANTIGO', 'status gravado envelhece: vale a data');
assert.equal(situacaoEfetiva({ status: 'LOCALIZADO_ANTIGO', data_modificacao_drive: dia(1) }, agora), 'LOCALIZADO_RECENTE');
assert.equal(situacaoEfetiva({ status: 'LOCALIZADO_ANTIGO', data_modificacao_drive: dia(8) }, agora, 14), 'LOCALIZADO_RECENTE', 'janela configurável');
assert.equal(situacaoEfetiva({ status: 'LOCALIZADO_RECENTE', data_modificacao_drive: '' }, agora), 'A_CONFERIR', 'sem data não é recente');
assert.equal(situacaoEfetiva({ status: 'SEM_PERMISSAO', data_modificacao_drive: dia(1) }, agora), 'SEM_PERMISSAO', 'falta de permissão ≠ ausência');
assert.equal(situacaoEfetiva({ status: 'NAO_ENCONTRADO_NA_PASTA' }, agora), 'NAO_ENCONTRADO_NA_PASTA');
assert.equal(situacaoEfetiva({}, agora), 'NAO_VERIFICADO', 'vazio nunca vira "não entregue"');
assert.equal(situacaoEfetiva({ status: 'qualquer coisa' }, agora), 'A_CONFERIR', 'valor desconhecido não é presumido');
assert.equal(situacaoEfetiva({ status: 'localizado recente', data_modificacao_drive: dia(0) }, agora), 'LOCALIZADO_RECENTE', 'tolera caixa/espaços');
assert(/Não indica entrega/.test(AVISO_MODIFICACAO));
assert.equal(titularTipoDe('Matrícula'), 'MATRICULA'); assert.equal(titularTipoDe('grupo'), 'GRUPO'); assert.equal(titularTipoDe('outra'), null);

// ---- Olyver: duas matrículas (2B e 3B), documentos individuais, sem mistura ----
const L = (o: Record<string, string>) => ({ periodo_id: 'p1', consultado_em: dia(0), ...o });
const linhas = [
  L({ monitoramento_id: 'mon1', turma_id: 't2b', titular_tipo: 'MATRICULA', titular_id: 'mOly2B', tipo_documento_id: 'DIARIO_CAMPO', arquivo_id: 'arq1', status: 'LOCALIZADO_RECENTE', data_modificacao_drive: dia(2) }),
  L({ monitoramento_id: 'mon2', turma_id: 't3b', titular_tipo: 'MATRICULA', titular_id: 'mOly3B', tipo_documento_id: 'DIARIO_CAMPO', arquivo_id: 'arq2', status: 'LOCALIZADO_ANTIGO', data_modificacao_drive: dia(20) }),
  L({ monitoramento_id: 'mon3', turma_id: 't1', titular_tipo: 'GRUPO', titular_id: 'g1', tipo_documento_id: 'RELATORIO_GRUPO', arquivo_id: 'arq3', status: 'LOCALIZADO_RECENTE', data_modificacao_drive: dia(1) }),
  L({ monitoramento_id: 'mon4', turma_id: 't3b', titular_tipo: 'MATRICULA', titular_id: 'mX', tipo_documento_id: 'DIARIO_CAMPO', arquivo_id: 'arq4', status: 'SEM_PERMISSAO' }),
];
const ctx2b = { matriculasDaTurma: [{ matricula_id: 'mOly2B' }], gruposDaTurma: [] };
assert.deepEqual(documentosDaTurma(linhas, 't2b', ctx2b, agora).map(d => d.id), ['mon1'], 'turma 2B só vê o documento da matrícula 2B');
assert.deepEqual(documentosDaTurma(linhas, 't3b', { matriculasDaTurma: [{ matricula_id: 'mOly3B' }, { matricula_id: 'mX' }], gruposDaTurma: [] }, agora).map(d => d.id).sort(), ['mon2', 'mon4']);
const oly2 = documentosDoEstudante(linhas, 'mOly2B', [], agora), oly3 = documentosDoEstudante(linhas, 'mOly3B', [], agora);
assert.deepEqual(oly2.individuais.map(d => d.id), ['mon1']); assert.deepEqual(oly3.individuais.map(d => d.id), ['mon2'], 'cada matrícula vê só o seu diário');
assert.equal(oly2.individuais[0].rotulo, 'Diario campo', 'rótulo legível sem expor nome do arquivo');

// ---- Clínica Ampliada: documento do GRUPO aparece 1x; estudantes veem como coletivo ----
const ctxAmp = { matriculasDaTurma: [{ matricula_id: 'mA' }, { matricula_id: 'mB' }, { matricula_id: 'mC' }], gruposDaTurma: [{ grupo_id: 'g1' }] };
assert.equal(documentosDaTurma(linhas, 't1', ctxAmp, agora).length, 1, 'um único documento coletivo na turma, não um por integrante');
for (const m of ['mA', 'mB']) { const d = documentosDoEstudante(linhas, m, ['g1'], agora); assert.equal(d.coletivos.length, 1); assert.equal(d.individuais.length, 0); assert.equal(d.coletivos[0].id, 'mon3'); }
assert.equal(documentosDoEstudante(linhas, 'mC', ['g2'], agora).coletivos.length, 0, 'quem não é do grupo não vê');
assert.equal(documentosDoGrupo(linhas, 'g1', agora).length, 1);
// sem turma_id na linha: vínculo pelo titular
assert.equal(documentosDaTurma([L({ titular_tipo: 'GRUPO', titular_id: 'g1', tipo_documento_id: 'X', arquivo_id: 'a' })], 't1', ctxAmp, agora).length, 1);
assert.equal(documentosDaTurma([L({ titular_tipo: 'GRUPO', titular_id: 'g9', tipo_documento_id: 'X', arquivo_id: 'a' })], 't1', ctxAmp, agora).length, 0);

// ---- resumo e diagnóstico ----
const docs = linhas.map(l => normalizarMonitoramento(l as any, agora));
const rs = resumirMonitoramento(docs, agora);
assert.equal(rs.total, 4); assert.equal(rs.porSituacao.SEM_PERMISSAO, 1); assert.equal(rs.porSituacao.LOCALIZADO_RECENTE, 2);
assert.equal(resumirMonitoramento([normalizarMonitoramento({ ...linhas[0], consultado_em: dia(3) } as any, agora)], agora).desatualizados, 1, 'consulta com mais de 36 h = sincronização parada');
assert.equal(resumirMonitoramento([normalizarMonitoramento({ ...linhas[0], erro_codigo: 'DRIVE_500' } as any, agora)], agora).comErro, 1);
assert.equal(resumirMonitoramento([normalizarMonitoramento({ ...linhas[0], erro_codigo: 'DRIVE_403' } as any, agora)], agora).comErro, 0, 'ausência/permissão é achado, não erro técnico');
const ctxD = { matriculas: [{ matricula_id: 'mOly2B' }, { matricula_id: 'mOly3B' }], grupos: [{ grupo_id: 'g1' }] };
const diag = diagnosticarMonitoramento(linhas as any, ctxD);
assert(diag.some(d => /"mX" não existe/.test(d.texto)), 'matrícula inexistente apontada');
assert(!diag.some(d => /mOly2B|mOly3B|g1/.test(d.texto)), 'vínculos corretos não geram problema');
assert(diagnosticarMonitoramento([...linhas, linhas[0]] as any, ctxD).some(d => /duplica a linha 2/.test(d.texto)), 'duplicata');
assert(diagnosticarMonitoramento([{ titular_tipo: 'MATRICULA', titular_id: 'mOly2B', arquivo_id: 'a' }] as any, ctxD).some(d => /Colunas ausentes/.test(d.texto)));
assert.equal(diagnosticarMonitoramento([], ctxD)[0].nivel, 'AVISO');

// ---- condição da matrícula (sem cadastro paralelo) ----
assert.deepEqual(condicoesDaMatricula({ papel_na_turma: 'REPRESENTANTE; supervisao_horario_alternativo' }), ['REPRESENTANTE', 'SUPERVISAO_HORARIO_ALTERNATIVO']);
assert.equal(temSupervisaoHorarioAlternativo({ papel_na_turma: 'SUPERVISAO_HORARIO_ALTERNATIVO' }), true);
assert.equal(temSupervisaoHorarioAlternativo({ papel_na_turma: 'REPRESENTANTE' }), false);
assert.equal(temSupervisaoHorarioAlternativo({ papel_na_turma: '' }), false); assert.equal(temSupervisaoHorarioAlternativo({}), false); assert.equal(temSupervisaoHorarioAlternativo(null), false);
assert.equal(geraRegistroAutomatico({ papel_na_turma: 'SUPERVISAO_HORARIO_ALTERNATIVO' }, false), false, 'sem presença nem falta automática');
assert.equal(geraRegistroAutomatico({ papel_na_turma: 'SUPERVISAO_HORARIO_ALTERNATIVO' }, true), true, 'marcação explícita da professora é registrada');
assert.equal(geraRegistroAutomatico({ papel_na_turma: '' }, false), true, 'demais estudantes seguem a regra da chamada');
console.log('Monitoramento de documentos e condição de supervisão alternativa validados.');
