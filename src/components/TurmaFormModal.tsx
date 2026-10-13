import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useSupervisao, NovoHorarioInput, NovaOrigemInput } from '../context/SupervisaoContext';
import type { Turma } from '../types';
import { Botao, CLASSE_INPUT, Campo, Janela } from './ui';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Criar/editar turma: disciplina, nome, turno, horários e códigos do Docente Online. */
export const TurmaFormModal: React.FC<{ turma: Turma | null; aoFechar: () => void }> = ({ turma, aoFechar }) => {
  const { disciplinas, horariosTurma, turmasOrigem, addTurma, updateTurma } = useSupervisao();
  const [disciplinaId, setDisciplinaId] = useState(turma?.disciplina_id || disciplinas[0]?.disciplina_id || '');
  const [nome, setNome] = useState(turma?.nome || '');
  const [turno, setTurno] = useState<Turma['turno']>(turma?.turno || 'MATUTINO');
  const [horarios, setHorarios] = useState<NovoHorarioInput[]>(() => {
    const atuais = turma ? horariosTurma.filter(h => h.turma_id === turma.turma_id && h.dia_semana !== null) : [];
    return atuais.length
      ? atuais.map(h => ({ dia_semana: Number(h.dia_semana), hora_inicio: h.hora_inicio, hora_fim: h.hora_fim }))
      : [{ dia_semana: 2, hora_inicio: '08:20', hora_fim: '11:00' }];
  });
  const [origens, setOrigens] = useState<NovaOrigemInput[]>(() => {
    const atuais = turma ? turmasOrigem.filter(o => o.turma_id === turma.turma_id && o.ativo) : [];
    return atuais.length ? atuais.map(o => ({ sistema: o.sistema, codigo_externo: o.codigo_externo, nome_externo: o.nome_externo }))
      : [{ sistema: 'Docente Online', codigo_externo: '', nome_externo: '' }];
  });
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!nome.trim() || !disciplinaId) return;
    setSalvando(true);
    try {
      const dados = {
        disciplina_id: disciplinaId, nome: nome.trim(), turno,
        horarios: horarios.filter(h => h.hora_inicio && h.hora_fim),
        origens: origens.filter(o => o.codigo_externo.trim()),
      };
      if (turma) await updateTurma(turma.turma_id, dados);
      else await addTurma(dados);
      aoFechar();
    } finally {
      setSalvando(false);
    }
  };

  const mudarHorario = (i: number, campo: keyof NovoHorarioInput, valor: string | number) =>
    setHorarios(h => h.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));
  const mudarOrigem = (i: number, campo: keyof NovaOrigemInput, valor: string) =>
    setOrigens(o => o.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  return (
    <Janela
      titulo={turma ? 'Editar turma' : 'Nova turma'}
      aoFechar={aoFechar}
      rodape={<>
        <Botao onClick={aoFechar}>Cancelar</Botao>
        <Botao variante="primario" onClick={salvar} disabled={salvando || !nome.trim()}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
      </>}
    >
      <div className="space-y-4">
        <Campo rotulo="Disciplina">
          <select className={CLASSE_INPUT} value={disciplinaId} onChange={e => setDisciplinaId(e.target.value)}>
            {disciplinas.map(d => <option key={d.disciplina_id} value={d.disciplina_id}>{d.nome} ({d.codigo})</option>)}
          </select>
        </Campo>
        <Campo rotulo="Nome da turma">
          <input className={CLASSE_INPUT} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Clínica Adulto — Matutino" />
        </Campo>
        <Campo rotulo="Turno">
          <select className={CLASSE_INPUT} value={turno} onChange={e => setTurno(e.target.value as Turma['turno'])}>
            <option value="MATUTINO">Matutino</option>
            <option value="VESPERTINO">Vespertino</option>
            <option value="NOTURNO">Noturno</option>
            <option value="INTEGRAL">Integral</option>
          </select>
        </Campo>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">Dia e horário da supervisão</span>
            <Botao variante="fantasma" tamanho="sm" icone={<Plus className="w-4 h-4" />}
              onClick={() => setHorarios(h => [...h, { dia_semana: 2, hora_inicio: '18:30', hora_fim: '21:10' }])}>Adicionar</Botao>
          </div>
          <div className="space-y-2">
            {horarios.map((h, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select className={`${CLASSE_INPUT} w-36`} value={h.dia_semana} onChange={e => mudarHorario(i, 'dia_semana', Number(e.target.value))}>
                  {DIAS.map((d, n) => <option key={d} value={n}>{d}</option>)}
                </select>
                <input type="time" className={`${CLASSE_INPUT} w-32`} value={h.hora_inicio} onChange={e => mudarHorario(i, 'hora_inicio', e.target.value)} />
                <span className="text-slate-500">às</span>
                <input type="time" className={`${CLASSE_INPUT} w-32`} value={h.hora_fim} onChange={e => mudarHorario(i, 'hora_fim', e.target.value)} />
                {horarios.length > 1 && (
                  <button onClick={() => setHorarios(x => x.filter((_, j) => j !== i))} aria-label="Remover horário" className="p-2 text-slate-400 hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">Códigos do Docente Online</span>
            <Botao variante="fantasma" tamanho="sm" icone={<Plus className="w-4 h-4" />}
              onClick={() => setOrigens(o => [...o, { sistema: 'Docente Online', codigo_externo: '', nome_externo: '' }])}>Adicionar</Botao>
          </div>
          <div className="space-y-2">
            {origens.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input className={`${CLASSE_INPUT} uppercase`} value={o.codigo_externo} onChange={e => mudarOrigem(i, 'codigo_externo', e.target.value)} placeholder="Ex.: TER-M-1A" />
                <input className={CLASSE_INPUT} value={o.nome_externo} onChange={e => mudarOrigem(i, 'nome_externo', e.target.value)} placeholder="Descrição (opcional)" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Janela>
  );
};
