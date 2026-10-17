import { strict as assert } from 'node:assert';
import { prepararEncerramentoChamada, naoRegistrados, naoConfirmadosRetrospectivos, type ItemChamada, type ExcecaoChamada } from '../services/chamadaService';

const it = (id: string, papel = ''): ItemChamada => ({ matricula: { matricula_id: id, papel_na_turma: papel }, aluno: { nome: 'Estudante ' + id } });
const lista = [it('m1'), it('m2'), it('m3'), it('m4'), it('m5', 'SUPERVISAO_HORARIO_ALTERNATIVO'), it('m6', 'SUPERVISAO_HORARIO_ALTERNATIVO')];
const exc: Record<string, ExcecaoChamada> = {
  m2: { faltou: true, atraso: false, celular: false },
  m3: { faltou: true, atraso: false, celular: false, justificativa: 'Atestado apresentado' },
  m4: { faltou: false, atraso: true, celular: false },
  m6: { faltou: false, atraso: false, celular: false, observacao: 'veio à aula coletiva' },
};

// Com a chamada aberta, sem marcação = NÃO REGISTRADO (nunca presente nem ausente)
assert.deepEqual(naoRegistrados(lista, exc).map(i => i.matricula.matricula_id), ['m1', 'm5'], 'm1 e m5 ainda sem marcação');
assert.deepEqual(naoRegistrados(lista, {}).length, 6);

const p = prepararEncerramentoChamada(lista, exc);
assert.deepEqual(p.presentes.map(i => i.matricula.matricula_id), ['m1', 'm4', 'm6'], 'prévia: quem será considerado presente (inclui atraso e marcação explícita)');
assert.deepEqual(p.atrasos.map(i => i.matricula.matricula_id), ['m4']);
assert.deepEqual(p.faltas.map(f => `${f.item.matricula.matricula_id}:${f.status}`), ['m2:FALTA_SEM_JUSTIFICATIVA', 'm3:JUSTIFICATIVA_PENDENTE'], 'mapeamento existente preservado; justificativa não vira abono');
assert.deepEqual(p.semRegistro.map(i => i.matricula.matricula_id), ['m5'], 'horário alternativo sem marcação: nada é gravado');
assert.equal(p.registros.length, 5, 'registros = presentes + faltas (m5 fora)');
assert(!p.registros.some(r => r.matriculaId === 'm5'));
assert.equal(p.registros.find(r => r.matriculaId === 'm4')!.atraso, true);

// Ninguém marcado: todos (exceto horário alternativo) entram na prévia como presentes — só serão gravados após confirmação
const todos = prepararEncerramentoChamada(lista, {});
assert.equal(todos.presentes.length, 4); assert.equal(todos.semRegistro.length, 2); assert.equal(todos.faltas.length, 0);
// A prévia é função pura: não grava nada
assert.equal(typeof prepararEncerramentoChamada, 'function');
assert.deepEqual(naoConfirmadosRetrospectivos(lista,{},true).map(x=>x.matricula.matricula_id),['m1','m2','m3','m4']);
assert.deepEqual(naoConfirmadosRetrospectivos(lista,{m1:true,m2:true,m3:true,m4:true},true),[]);
assert.deepEqual(naoConfirmadosRetrospectivos(lista,{},false),[]);
assert.deepEqual(naoConfirmadosRetrospectivos(lista,{m1:true},true).map(x=>x.matricula.matricula_id),['m2','m3','m4']);
console.log('Chamada: NÃO REGISTRADO até encerrar, prévia dos presentes e regra de horário alternativo validados.');
