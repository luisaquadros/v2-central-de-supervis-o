import React, { useMemo, useState } from 'react';
import { Check, Circle, Plus, Trash2 } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { useNavegacao } from '../context/NavegacaoContext';
import { formatarDataBr } from '../services/supervisaoOperacionalService';
import { Botao, CLASSE_INPUT, Selo, Vazio } from './ui';

const DURACOES = [5, 15, 30];

/** Minhas tarefas: lembretes curtos, filtráveis pelo tempo livre que você tem agora. */
export const TarefasLista: React.FC<{ limite?: number }> = ({ limite }) => {
  const { tarefas, addTarefa, toggleTarefa, solicitarExclusao, matriculas, alunos, hojeIso } = useSupervisao();
  const { abrirAluno, abrirAba } = useNavegacao();
  const [titulo, setTitulo] = useState('');
  const [duracao, setDuracao] = useState(5);
  const [tempoLivre, setTempoLivre] = useState<number | null>(null);
  const [verConcluidas, setVerConcluidas] = useState(false);

  const nomeAluno = (matriculaId?: string) => {
    const m = matriculas.find(x => x.matricula_id === matriculaId);
    return alunos.find(a => a.aluno_id === m?.aluno_id)?.nome;
  };

  const pendentes = useMemo(() => {
    const ordemPrioridade = { ALTA: 0, MEDIA: 1, BAIXA: 2 } as const;
    return tarefas
      .filter(t => t.status !== 'CONCLUIDO' && (tempoLivre === null || t.duracao_minutos <= tempoLivre))
      .sort((a, b) => ordemPrioridade[a.prioridade] - ordemPrioridade[b.prioridade] || String(a.prazo || '9').localeCompare(String(b.prazo || '9')));
  }, [tarefas, tempoLivre]);
  const concluidas = tarefas.filter(t => t.status === 'CONCLUIDO');
  const visiveis = limite ? pendentes.slice(0, limite) : pendentes;

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    await addTarefa({ titulo, duracao_minutos: duracao });
    setTitulo('');
  };

  return (
    <div className="space-y-3">
      <form onSubmit={adicionar} className="flex flex-wrap gap-2">
        <input className={`${CLASSE_INPUT} flex-1 min-w-48`} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Novo lembrete… (ex.: enviar e-mail para a coordenação)" />
        <div className="flex gap-1" role="group" aria-label="Duração">
          {DURACOES.map(d => (
            <button key={d} type="button" onClick={() => setDuracao(d)}
              className={`min-h-10 px-3 rounded-xl text-sm font-semibold border cursor-pointer ${duracao === d ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-700'}`}>
              {d} min
            </button>
          ))}
        </div>
        <Botao type="submit" variante="primario" icone={<Plus className="w-4 h-4" />} disabled={!titulo.trim()}>Guardar</Botao>
      </form>

      {tarefas.some(t => t.status !== 'CONCLUIDO') && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-600">Tenho:</span>
          {[null, ...DURACOES].map(d => (
            <button key={String(d)} onClick={() => setTempoLivre(d)}
              className={`px-3 py-1 rounded-full border cursor-pointer ${tempoLivre === d ? 'bg-amber-100 border-amber-300 text-amber-950 font-semibold' : 'bg-white border-slate-300 text-slate-700'}`}>
              {d === null ? 'qualquer tempo' : `${d} min`}
            </button>
          ))}
        </div>
      )}

      {visiveis.length === 0 ? (
        <Vazio titulo={tempoLivre ? 'Nada que caiba nesse tempo' : 'Nenhum lembrete pendente'} texto="Use “Anotar” (tecla N) para guardar algo sem parar o que está fazendo." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {visiveis.map(t => {
            const aluno = nomeAluno(t.matricula_id);
            const atrasada = t.prazo && t.prazo < hojeIso;
            return (
              <li key={t.id} className="py-2 flex items-center gap-3">
                <button onClick={() => void toggleTarefa(t.id)} aria-label="Marcar como feito" className="p-1 text-slate-400 hover:text-emerald-600 cursor-pointer">
                  <Circle className="w-6 h-6" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 break-words">{t.titulo}</p>
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    <Selo>{t.duracao_minutos} min</Selo>
                    {t.prioridade === 'ALTA' && <Selo cor="vermelho">prioridade</Selo>}
                    {t.prazo && <Selo cor={atrasada ? 'vermelho' : 'azul'}>até {formatarDataBr(t.prazo)}</Selo>}
                    {aluno && t.matricula_id && (
                      <button onClick={() => abrirAluno(t.matricula_id!)} className="text-xs font-semibold text-slate-600 underline cursor-pointer">{aluno}</button>
                    )}
                  </div>
                </div>
                <button onClick={() => solicitarExclusao({ nome: 'Lembrete', tabela: 'tarefas_professora', registro: t })}
                  aria-label="Excluir lembrete" className="p-2 text-slate-400 hover:text-red-600 cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {limite && pendentes.length > limite && (
        <button onClick={() => abrirAba('pendencias')} className="text-sm font-semibold text-slate-700 underline cursor-pointer">
          Ver todos os {pendentes.length} lembretes
        </button>
      )}

      {!limite && concluidas.length > 0 && (
        <div>
          <button onClick={() => setVerConcluidas(v => !v)} className="text-sm font-semibold text-slate-600 cursor-pointer">
            {verConcluidas ? 'Ocultar' : 'Mostrar'} concluídos ({concluidas.length})
          </button>
          {verConcluidas && (
            <ul className="mt-2 space-y-1">
              {concluidas.map(t => (
                <li key={t.id} className="flex items-center gap-3 text-slate-500">
                  <button onClick={() => void toggleTarefa(t.id)} aria-label="Reabrir" className="p-1 text-emerald-600 cursor-pointer"><Check className="w-5 h-5" /></button>
                  <span className="line-through flex-1">{t.titulo}</span>
                  <button onClick={() => solicitarExclusao({ nome: 'Lembrete', tabela: 'tarefas_professora', registro: t })} aria-label="Excluir" className="p-2 hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
