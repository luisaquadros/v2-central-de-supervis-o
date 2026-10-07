import {
  identificarSupervisaoAtual,
  identificarProximaSupervisao,
  identificarChamadasPendentes,
  derivarNotificacoesOperacionais,
  derivarPendenciasOperacionais,
  getHojeDataIso,
} from '../services/supervisaoOperacionalService';
import {
  Turma,
  HorarioTurma,
  Frequencia,
  Matricula,
  Aluno,
  EncontroTurma,
  LeituraResponsavel,
  MarcoAcademico,
  Documento,
  RegistroSemanal,
  Orientacao,
} from '../types';

console.log('--- INICIANDO BATERIA DE TESTES OPERACIONAIS OBRIGATÓRIOS ---');

// Mock básico
const turmaTeste: Turma = {
  turma_id: 'turma-1',
  periodo_id: 'per-1',
  disciplina_id: 'disc-1',
  nome: 'Clínica Ampliada — Noturno',
  turno: 'NOTURNO',
  status: 'ATIVO',
};

const horarioSegunda: HorarioTurma = {
  horario_id: 'h-1',
  turma_id: 'turma-1',
  dia_semana: 1, // Segunda-feira
  hora_inicio: '18:30',
  hora_fim: '21:12',
  data_inicio: '2026-08-01',
  data_fim: '2026-12-15',
  ativo: true,
};

const matriculaAluno1: Matricula = {
  matricula_id: 'mat-1',
  aluno_id: 'al-1',
  turma_id: 'turma-1',
  periodo_id: 'per-1',
  status: 'MATRICULADO',
  origem_id: 'orig-1',
};

const matriculaAluno2: Matricula = {
  matricula_id: 'mat-2',
  aluno_id: 'al-2',
  turma_id: 'turma-1',
  periodo_id: 'per-1',
  status: 'MATRICULADO',
  origem_id: 'orig-1',
};

const matriculas = [matriculaAluno1, matriculaAluno2];
const alunos: Aluno[] = [
  { aluno_id: 'al-1', nome: 'Ana Silva', identificador_academico: '20230101', status: 'ATIVO' },
  { aluno_id: 'al-2', nome: 'Carlos Souza', identificador_academico: '20230102', status: 'ATIVO' },
];

let passes = 0;
let fails = 0;

function assert(cond: boolean, desc: string) {
  if (cond) {
    console.log(`[PASS] ${desc}`);
    passes++;
  } else {
    console.error(`[FAIL] ${desc}`);
    fails++;
  }
}

// Data de teste: Segunda-feira às 19h (durante a aula)
const segundaDuranteAula = new Date('2026-10-05T19:00:00'); // 2026-10-05 é segunda-feira
const dataHoje = getHojeDataIso(segundaDuranteAula);

// -------------------------------------------------------------
// TESTE 1: Aula normal em andamento
// -------------------------------------------------------------
const supAtualNormal = identificarSupervisaoAtual(
  [turmaTeste],
  [horarioSegunda],
  [],
  [],
  matriculas,
  segundaDuranteAula
);
assert(supAtualNormal.emAndamento === true, '1. Aula normal é detectada em andamento às 19h');
assert(supAtualNormal.turma?.turma_id === 'turma-1', '1. Identifica turma correta');

// -------------------------------------------------------------
// TESTE 2: Feriado previamente cadastrado
// -------------------------------------------------------------
const encontroFeriado: EncontroTurma = {
  encontro_id: 'enc-feriado',
  turma_id: 'turma-1',
  data: dataHoje,
  status: 'NAO_REALIZADO',
  motivo_nao_realizado: 'Feriado',
  observacao: 'Feriado Nacional',
};

const supAtualFeriado = identificarSupervisaoAtual(
  [turmaTeste],
  [horarioSegunda],
  [],
  [encontroFeriado],
  matriculas,
  segundaDuranteAula
);
assert(supAtualFeriado.emAndamento === false, '2. Feriado: Não marca como em andamento');
assert(supAtualFeriado.naoRealizadaHoje === true, '2. Feriado: Identifica aula não realizada hoje');
assert(supAtualFeriado.motivoNaoRealizada === 'Feriado', '2. Feriado: Preserva motivo correto');

// -------------------------------------------------------------
// TESTE 3: Recesso acadêmico
// -------------------------------------------------------------
const encontroRecesso: EncontroTurma = {
  encontro_id: 'enc-recesso',
  turma_id: 'turma-1',
  data: dataHoje,
  status: 'NAO_REALIZADO',
  motivo_nao_realizado: 'Recesso acadêmico',
};
const supAtualRecesso = identificarSupervisaoAtual(
  [turmaTeste],
  [horarioSegunda],
  [],
  [encontroRecesso],
  matriculas,
  segundaDuranteAula
);
assert(supAtualRecesso.motivoNaoRealizada === 'Recesso acadêmico', '3. Recesso acadêmico identificado com sucesso');

// -------------------------------------------------------------
// TESTE 4: Cancelamento no mesmo dia / depois de estar prevista
// -------------------------------------------------------------
const encontroCanceladoProf: EncontroTurma = {
  encontro_id: 'enc-canc-prof',
  turma_id: 'turma-1',
  data: dataHoje,
  status: 'NAO_REALIZADO',
  motivo_nao_realizado: 'Cancelamento da professora',
  observacao: 'Compromisso institucional extraordinário',
};
const supAtualCanc = identificarSupervisaoAtual(
  [turmaTeste],
  [horarioSegunda],
  [],
  [encontroCanceladoProf],
  matriculas,
  segundaDuranteAula
);
assert(supAtualCanc.naoRealizadaHoje === true, '4. Cancelamento no dia: detectado como não realizada');

// -------------------------------------------------------------
// TESTE 5: Cálculo de chamada pendente — Confirmar que NÃO GERA CHAMADA PENDENTE
// -------------------------------------------------------------
const segundaAposAula = new Date('2026-10-05T22:30:00'); // Após 21:12
// Sem cancelamento: a aula de hoje que passou do horário DEVE constar como pendente
const pendentesSemCancelamento = identificarChamadasPendentes(
  [turmaTeste],
  [horarioSegunda],
  [],
  [],
  matriculas,
  segundaAposAula,
  0 // Apenas o dia de hoje
);
assert(
  pendentesSemCancelamento.some(p => p.dataAula === dataHoje),
  '5. Sem cancelamento: Aula passada sem chamada gera pendência'
);

// Com cancelamento (NAO_REALIZADO): NÃO DEVE GERAR CHAMADA PENDENTE
const pendentesComCancelamento = identificarChamadasPendentes(
  [turmaTeste],
  [horarioSegunda],
  [],
  [encontroFeriado],
  matriculas,
  segundaAposAula,
  0 // Apenas o dia de hoje
);
assert(
  !pendentesComCancelamento.some(p => p.dataAula === dataHoje),
  '5. Com Feriado/Cancelamento: NÃO gera chamada pendente (ZERO pendências no dia)'
);

// -------------------------------------------------------------
// TESTE 6: Reagendamento
// -------------------------------------------------------------
const encontroReagendado: EncontroTurma = {
  encontro_id: 'enc-reag-orig',
  turma_id: 'turma-1',
  data: dataHoje,
  status: 'REAGENDADO',
  data_reagendada: '2026-10-08',
  hora_reagendada: '14:00 - 16:40',
  motivo_nao_realizado: 'Reposição de aula',
};

const supAtualReag = identificarSupervisaoAtual(
  [turmaTeste],
  [horarioSegunda],
  [],
  [encontroReagendado],
  matriculas,
  segundaDuranteAula
);
assert(supAtualReag.emAndamento === false, '6. Reagendado: Data original não fica em andamento');
assert(supAtualReag.reagendadaHoje === true, '6. Reagendado: Identifica que foi reagendada a partir de hoje');
assert(supAtualReag.dataReagendada === '2026-10-08', '6. Reagendado: Aponta para a nova data');

const pendentesReag = identificarChamadasPendentes(
  [turmaTeste],
  [horarioSegunda],
  [],
  [encontroReagendado],
  matriculas,
  segundaAposAula,
  0 // Apenas o dia de hoje
);
assert(
  !pendentesReag.some(p => p.dataAula === dataHoje),
  '6. Reagendado: Data original NÃO gera chamada pendente'
);

// -------------------------------------------------------------
// TESTE 7 & 8: Estudo Dirigido com aula cancelada NÃO gera pendência contra o aluno
// -------------------------------------------------------------
const leituraPrevistaHoje: LeituraResponsavel = {
  leitura_id: 'leit-1',
  turma_id: 'turma-1',
  data: '2026-10-01', // Data anterior
  tema: 'Clínica Psicanalítica e Vínculo',
  status_realizacao: 'PLANEJADO',
  responsavel_nome: 'Ana Silva',
  responsavel_id: 'mat-1',
};

// Se a aula foi cancelada nessa data
const encontroAula1Canc: EncontroTurma = {
  encontro_id: 'enc-1-canc',
  turma_id: 'turma-1',
  data: '2026-10-01',
  status: 'NAO_REALIZADO',
  motivo_nao_realizado: 'Feriado',
};

const notifsComAulaCancelada = derivarNotificacoesOperacionais(
  [turmaTeste],
  matriculas,
  [],
  [],
  [],
  [],
  [leituraPrevistaHoje],
  [encontroAula1Canc],
  [horarioSegunda],
  segundaDuranteAula
);

const pendEstudoCanc = notifsComAulaCancelada.filter(n => n.tipo === 'ESTUDO_DIRIGIDO_PENDENTE');
assert(
  pendEstudoCanc.length === 0,
  '7 & 8. Estudo Dirigido em aula cancelada NÃO gera pendência punitiva contra o aluno'
);

// -------------------------------------------------------------
// TESTE 9: Notificações informativas vs Requer Ação
// -------------------------------------------------------------
const notifsFeriadoHoje = derivarNotificacoesOperacionais(
  [turmaTeste],
  matriculas,
  [],
  [],
  [],
  [],
  [],
  [encontroFeriado],
  [horarioSegunda],
  segundaDuranteAula
);
const notifFeriado = notifsFeriadoHoje.find(n => n.tipo === 'FERIADO');
assert(notifFeriado !== undefined, '9. Feriado gera notificação de informativo');
assert(notifFeriado?.categoria === 'INFORMATIVO', '9. Notificação de feriado é categorizada como INFORMATIVO (não REQUER_ACAO)');

// -------------------------------------------------------------
// TESTE 10: Próxima Supervisão salta feriados
// -------------------------------------------------------------
const proximaSup = identificarProximaSupervisao(
  [turmaTeste],
  [horarioSegunda],
  [encontroFeriado],
  segundaDuranteAula
);
// Como a segunda de hoje é feriado, deve encontrar a próxima supervisão válida
assert(proximaSup !== null, '10. Próxima supervisão encontrada com sucesso');
assert(proximaSup?.dataProxima !== dataHoje, '10. Próxima supervisão pula o feriado de hoje e agenda para o próximo dia válido');

console.log(`\n--- RESULTADO FINAL: ${passes} PASSOU / ${fails} FALHOU ---`);
if (fails > 0) process.exit(1);
