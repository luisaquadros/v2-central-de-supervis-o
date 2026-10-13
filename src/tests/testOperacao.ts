/**
 * Regras de operação da supervisão com dados no formato real da planilha (fictícios).
 * Agenda, feriados, chamadas pendentes, pendências acionáveis (sem RSS), RSS por turma,
 * estudo dirigido e notas.
 */
import { strict as assert } from 'node:assert';
import {
  aulasDoDia,
  calcularMetricasCronogramaRss,
  feriadoNacional,
  gerarPendencias,
  gerarRssDaTurma,
  identificarChamadasPendentes,
  identificarProximaSupervisao,
  identificarSupervisaoAtual,
  leiturasDoEncontro,
  resolverResponsaveisLeitura,
  obterSemanaRssValidada,
  LIMITE_FALTAS_RISCO,
} from '../services/supervisaoOperacionalService';
import { normalizarLinhasDaAba } from '../services/normalizacaoPlanilha';
import { validarEscritaTabela } from '../services/safeWriteService';
import { normalizarNota, formatarNotaParaExibicao } from '../utils/gradeUtils';

let total = 0;
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); total++; };
const igual = (a: unknown, b: unknown, msg: string) => { assert.deepEqual(a, b, msg); total++; };

// Dados no formato que vem da planilha (dia da semana por extenso, "TRUE" em texto).
const turma = { turma_id: 't-ad', periodo_id: 'p1', disciplina_id: 'd1', nome: 'Clínica Adulto', turno: 'MATUTINO', status: 'ATIVO' } as any;
const turmaNoite = { turma_id: 't-ca', periodo_id: 'p1', disciplina_id: 'd2', nome: 'Clínica Ampliada', turno: 'NOTURNO', status: 'ATIVO' } as any;
const horarios = normalizarLinhasDaAba('horarios_turma', [
  { horario_id: 'h1', turma_id: 't-ad', dia_semana: 'TERCA', hora_inicio: '08:20', hora_fim: '11:00', data_inicio: '2026-08-11', data_fim: '2026-12-01', ativo: true },
  { horario_id: 'h2', turma_id: 't-ca', dia_semana: 'SEGUNDA', hora_inicio: '18:30', hora_fim: '21:10', data_inicio: '2026-08-10', data_fim: '2026-11-30', ativo: true },
]) as any[];
const mats = [
  { matricula_id: 'm1', aluno_id: 'a1', turma_id: 't-ad', periodo_id: 'p1', status: 'MATRICULADO' },
  { matricula_id: 'm2', aluno_id: 'a2', turma_id: 't-ad', periodo_id: 'p1', status: 'MATRICULADO' },
  { matricula_id: 'm3', aluno_id: 'a3', turma_id: 't-ca', periodo_id: 'p1', status: 'MATRICULADO' },
  { matricula_id: 'm4', aluno_id: 'a4', turma_id: 't-ca', periodo_id: 'p1', status: 'MATRICULADO' },
] as any[];
const alunos = [
  { aluno_id: 'a1', nome: 'Ana Beatriz Souza', identificador_academico: '', status: 'ATIVO' },
  { aluno_id: 'a2', nome: 'Carla Mendes', identificador_academico: '', status: 'ATIVO' },
  { aluno_id: 'a3', nome: 'Diego Lima', identificador_academico: '', status: 'ATIVO' },
  { aluno_id: 'a4', nome: 'Elisa Rocha', identificador_academico: '', status: 'ATIVO' },
] as any[];
const turmas = [turma, turmaNoite];

// ---------------------------------------------------------------------------
// 1. Agenda
// ---------------------------------------------------------------------------
const terca9h = new Date(2026, 9, 13, 9, 0); // terça 13/10/2026 09:00
const atual = identificarSupervisaoAtual(turmas, horarios, [], [], mats, terca9h);
igual(atual.emAndamento?.turma.turma_id, 't-ad', 'aula de terça (TERCA na planilha) aparece em andamento');
const terca12h = new Date(2026, 9, 13, 12, 0);
igual(identificarSupervisaoAtual(turmas, horarios, [], [], mats, terca12h).chamadaPendenteHoje?.turma.turma_id, 't-ad',
  'aula encerrada sem chamada vira chamada pendente de hoje');
const prox = identificarProximaSupervisao(turmas, horarios, [], terca12h);
igual([prox?.turma.turma_id, prox?.dataProxima], ['t-ca', '2026-10-19'], 'próxima aula é a da segunda seguinte (não a primeira turma da lista)');
ok(identificarProximaSupervisao(turmas, horarios, [], new Date(2026, 9, 13, 7, 0))?.dataProxima === '2026-10-13', 'antes da aula, a próxima é hoje');

// ---------------------------------------------------------------------------
// 2. Feriados e aulas não realizadas nunca viram chamada pendente
// ---------------------------------------------------------------------------
igual(feriadoNacional('2026-10-12'), 'Nossa Senhora Aparecida', '12/10 é feriado');
igual(feriadoNacional('2026-02-17'), 'Carnaval', 'Carnaval calculado pela Páscoa');
igual(feriadoNacional('2026-10-13'), null, 'dia comum não é feriado');
const segunda12 = aulasDoDia('2026-10-12', turmas, horarios, [], [], mats);
igual(segunda12[0]?.situacao, 'NAO_REALIZADA', 'aula em feriado aparece como não realizada');

const encontros = normalizarLinhasDaAba('encontros_turma', [
  { encontro_id: 'aula-2026-10-06-ad', turma_id: 't-ad', data: '2026-10-06', status: 'NAO_REALIZADO', motivo_nao_realizado: 'Cancelamento informado pela professora' },
  { encontro_id: 'x', turma_id: 't-ca', data: '2026-10-05', status: 'REAGENDADO', data_reagendada: '2026-10-07', hora_reagendada: '18:30' },
  { encontro_id: 'y', turma_id: 't-ca', data: '2026-10-07', status: 'PREVISTO', data_original: '2026-10-05', hora_inicio: '18:30', hora_fim: '21:10' },
]) as any[];
const pendentes = identificarChamadasPendentes(turmas, horarios, [], encontros, mats, new Date(2026, 9, 13, 22, 0));
const chaves = pendentes.map(p => `${p.turma.turma_id}@${p.dataAula}`).sort();
igual(chaves, ['t-ad@2026-09-29', 't-ad@2026-10-13', 't-ca@2026-10-07'],
  'pendentes: só aulas que aconteceram (sem feriado 12/10, sem cancelada 06/10, reagendada conta na nova data)');
const comChamada = [{ frequencia_id: 'f1', matricula_id: 'm1', data_aula: '2026-10-13', status: 'PRESENTE' }] as any[];
ok(!identificarChamadasPendentes(turmas, horarios, comChamada, encontros, mats, new Date(2026, 9, 13, 22, 0))
  .some(p => p.dataAula === '2026-10-13'), 'chamada salva deixa de ser pendente');
ok(identificarChamadasPendentes(turmas, horarios, [], encontros, mats, new Date(2026, 9, 13, 22, 0), 14, '2026-10-01')
  .every(p => p.dataAula >= '2026-10-01'), 'nada antes do início do período');

// ---------------------------------------------------------------------------
// 3. Pendências: somente itens com ação direta; RSS NUNCA entra
// ---------------------------------------------------------------------------
const entregas = normalizarLinhasDaAba('entregas', [
  { entrega_id: 'e1', matricula_id: 'm1', tipo_entrega: 'TERMO_COMPROMISSO', status: 'A conferir' },
  { entrega_id: 'e2', matricula_id: 'm2', tipo_entrega: 'TERMO_COMPROMISSO', status: 'A conferir' },
  { entrega_id: 'e3', matricula_id: 'm2', tipo_entrega: 'MANUAL_ESTAGIO', status: 'Pendente' },
  { entrega_id: 'e4', matricula_id: 'm1', tipo_entrega: 'MANUAL_ESTAGIO', status: 'Enviado' },
  { entrega_id: 'e5', matricula_id: 'm1', tipo_entrega: 'DOCUMENTACAO_EXTERNA', status: 'Não se aplica' },
]) as any[];
const faltas = Array.from({ length: LIMITE_FALTAS_RISCO }, (_, i) => ({
  frequencia_id: `fx${i}`, matricula_id: 'm3', data_aula: `2026-09-0${i + 1}`, status: 'FALTA_SEM_JUSTIFICATIVA',
}));
const leituras = normalizarLinhasDaAba('leituras_responsaveis', [
  { leitura_agenda_id: 'L1', turma_id: 't-ad', data_discussao: '2026-10-13', tipo: 'ESTUDO_DIRIGIDO', titulo: 'Psicoterapia breve', responsaveis_texto: 'Ana Beatriz; Carla Mendes', responsavel_tipo: 'ALUNOS' },
  { leitura_agenda_id: 'L2', turma_id: 't-ad', data_discussao: '2026-10-06', tipo: 'ESTUDO_DIRIGIDO', titulo: 'Aula cancelada', responsaveis_texto: 'Ana', responsavel_tipo: 'ALUNO' },
  { leitura_agenda_id: 'L3', turma_id: 't-ad', data_discussao: '2026-10-13', tipo: 'LEITURA_RECOMENDADA', titulo: 'Sem responsável', responsavel_tipo: 'SEM_RESPONSAVEL' },
]) as any[];
const pend = gerarPendencias({
  periodo: { periodo_id: 'p1', nome: '2026.2', data_inicio: '2026-08-01', data_fim: '2026-12-20', status: 'ATIVO' },
  turmas, matriculas: mats, alunos,
  frequencias: [...faltas, { frequencia_id: 'fj', matricula_id: 'm1', data_aula: '2026-10-13', status: 'JUSTIFICATIVA_PENDENTE', justificativa: 'Atestado' }] as any,
  entregas, leituras, encontros, horarios,
  avaliacoesCompletas: [{ avaliacao_id: 'av1', matricula_id: 'm2', turma_id: 't-ad', status: 'APROVADO_ENVIO' }] as any,
}, new Date(2026, 9, 14, 9, 0));
const tipos = pend.map(p => p.tipo);
ok(!tipos.some(t => String(t).includes('RSS') || t === ('REGISTRO_SEMANAL' as any)), 'RSS não aparece nas pendências');
ok(tipos.includes('JUSTIFICATIVA') && tipos.includes('RISCO_FALTAS') && tipos.includes('DEVOLUTIVA'), 'justificativa, risco por faltas e devolutiva');
const conferir = pend.filter(p => p.tipo === 'DOCUMENTO_CONFERIR');
igual(conferir.length, 1, '2 termos "A conferir" da mesma turma viram 1 item agrupado');
igual(conferir[0].entrega_ids, ['e1', 'e2'], 'item agrupado guarda os documentos para conferência rápida');
igual(pend.filter(p => p.tipo === 'DOCUMENTO').length, 1, '"Pendente" vira item; "Enviado" e "Não se aplica" não');
igual(pend.filter(p => p.tipo === 'ESTUDO_DIRIGIDO').map(p => p.leitura_id), ['L1'],
  'estudo dirigido a confirmar: só o que aconteceu, com responsáveis e sem aula cancelada');
igual(pend[0].urgencia, 'CRITICA', 'mais urgentes primeiro (chamada)');

// ---------------------------------------------------------------------------
// 4. RSS dentro da turma (grupo da Clínica Ampliada é uma unidade)
// ---------------------------------------------------------------------------
const registros = normalizarLinhasDaAba('registros_semanais', [
  { registro_id: 'r1', grupo_id: 'g1', turma_id: 't-ca', matricula_id: 'm3', semana_rss: 5, status: 'RECEBIDO', status_revisao: 'VALIDADO' },
  { registro_id: 'r2', grupo_id: 'g1', turma_id: 't-ca', matricula_id: 'm4', semana_rss: 5, status: 'RECEBIDO', status_revisao: 'VALIDADO' },
  { registro_id: 'r3', grupo_id: 'g1', turma_id: 't-ca', matricula_id: 'm3', semana_rss: 6, status: 'RECEBIDO', status_revisao: 'PENDENTE_REVISAO' },
  { registro_id: 'r4', matricula_id: 'm1', turma_id: 't-ad', semana_rss: 6, status: 'RECEBIDO', status_revisao: 'VALIDADO' },
]) as any[];
igual(obterSemanaRssValidada(registros[2]), null, 'em revisão não comprova a semana');
const calendario = normalizarLinhasDaAba('calendario_rss', [
  { turma_id: 't-ad', sequencia: 6, semana_inicio: '2026-10-12', semana_fim: '2026-10-18' },
  { turma_id: 't-ad', sequencia: 5, semana_inicio: '2026-10-05', semana_fim: '2026-10-11' },
  { turma_id: 't-ca', sequencia: 6, semana_inicio: '2026-10-12', semana_fim: '2026-10-18' },
]) as any[];
const baseRss = {
  matriculas: mats, alunos, registrosSemanais: registros, regrasRss: [], situacaoAtualTurmas: [], calendarioRss: calendario,
  statusRssUnidades: [
    { turma_id: 't-ca', unidade_id: 'g1', unidade_tipo: 'GRUPO', rss_esperados_ate_hoje: 5, rss_recebidos_validos: 1 },
    { turma_id: 't-ad', unidade_id: 'm2', unidade_tipo: 'INDIVIDUAL', rss_esperados_ate_hoje: 5, rss_recebidos_validos: 2 },
  ] as any,
  gruposPratica: [{ grupo_id: 'g1', turma_id: 't-ca', nome_grupo: 'Grupo Acolher' }] as any,
  grupoIntegrantes: [{ grupo_id: 'g1', matricula_id: 'm3' }, { grupo_id: 'g1', matricula_id: 'm4' }] as any,
};
const rssCa = gerarRssDaTurma('t-ca', baseRss, '2026-10-14');
igual(rssCa.unidades.length, 1, 'Clínica Ampliada: o grupo é uma única unidade');
igual([rssCa.unidades[0].nome, rssCa.unidades[0].faltando, rssCa.unidades[0].integrantes.length], ['Grupo Acolher', 4, 2], 'grupo atrasado, com integrantes');
igual(rssCa.unidades[0].semEnvioNaSemana, false, 'grupo já enviou na semana 6 (em revisão conta como envio)');
const rssAd = gerarRssDaTurma('t-ad', baseRss, '2026-10-14');
igual(rssAd.metricas.semanaAtual, 6, 'semana atual pelas datas da própria turma');
igual(rssAd.semEnvioNaSemana.map(u => u.unidadeId), ['m2'], 'quem ainda não enviou o RSS desta semana');
igual(rssAd.atrasadas.map(u => u.unidadeId), ['m2'], 'quem está com RSS atrasado');
igual(calcularMetricasCronogramaRss('t-sem-calendario', calendario, [], '2026-10-14').semanaTexto, '—', 'turma sem calendário não herda de outra');

// ---------------------------------------------------------------------------
// 5. Estudo dirigido da aula e responsáveis por nome
// ---------------------------------------------------------------------------
igual(leiturasDoEncontro('t-ad', '2026-10-13', leituras, encontros).map(l => l.leitura_id), ['L1', 'L3'], 'leituras da aula do dia');
const reagendada = [{ turma_id: 't-ad', data: '2026-10-13', status: 'REAGENDADO', data_reagendada: '2026-10-15' }] as any[];
igual(leiturasDoEncontro('t-ad', '2026-10-15', leituras, reagendada).map(l => l.leitura_id), ['L1', 'L3'], 'leitura acompanha a aula reagendada');
igual(leiturasDoEncontro('t-ad', '2026-10-13', leituras, reagendada).length, 0, 'e sai da data original');
const responsaveis = resolverResponsaveisLeitura(leituras[0], mats.filter(m => m.turma_id === 't-ad').map(m => ({ matricula: m, aluno: alunos.find(a => a.aluno_id === m.aluno_id) })));
igual(responsaveis.map(r => r.matriculaId), ['m1', 'm2'], 'nomes da planilha ligados às matrículas da turma');

// ---------------------------------------------------------------------------
// 6. Escrita segura e notas
// ---------------------------------------------------------------------------
ok(!validarEscritaTabela('fonte_central_controle', {}).valido, 'abas de fonte são protegidas');
ok(!validarEscritaTabela('_RASCUNHO_alunos_reais', {}).valido, 'rascunhos são protegidos');
ok(!validarEscritaTabela('registros_semanais', {}).valido, 'RSS (fórmula) é somente leitura');
ok(!validarEscritaTabela('leituras_responsaveis', {}, 'INSERT').valido, 'leituras: só atualização');
ok(validarEscritaTabela('frequencias', {}, 'INSERT').valido, 'frequências podem ser gravadas');
igual(normalizarNota('8,5'), 8.5, 'nota com vírgula');
igual(normalizarNota(''), 'ausente', 'nota vazia é ausente (nunca zero)');
igual(normalizarNota('abc'), 'invalido', 'nota inválida');
igual(formatarNotaParaExibicao('8,5'), '8,5', 'exibição no padrão brasileiro');
igual(formatarNotaParaExibicao(null), '—', 'ausente aparece como —');

console.log(`[PASS] ${total} verificações de agenda, feriados, pendências (sem RSS), RSS por turma, estudo dirigido e notas.`);
