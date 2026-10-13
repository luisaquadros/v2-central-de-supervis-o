import React from 'react';
import { BookOpen, ListOrdered, MessageSquare, Play, UserRound } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { useNavegacao } from '../context/NavegacaoContext';
import { formatarDiaCurto } from '../services/supervisaoOperacionalService';
import { FilaCasos } from '../views/ModoSupervisaoView';
import { Botao, Janela, Selo } from './ui';

/** Resumo de 2 minutos antes da aula: leitura do dia, quem precisa de atenção, o que retomar e a fila de casos. */
export const PrepararAulaModal: React.FC<{ turmaId: string; data: string }> = ({ turmaId, data }) => {
  const { turmas, getAlunosDaTurma, getResumoAlunoSupervisao, getLeiturasDoEncontro, getResponsaveisLeitura, orientacoes, hojeIso } = useSupervisao();
  const { fecharPreparar, abrirAula, abrirAluno } = useNavegacao();
  const turma = turmas.find(t => t.turma_id === turmaId);
  const alunos = getAlunosDaTurma(turmaId);
  const ids = new Set(alunos.map(a => a.matricula.matricula_id));
  const resumos = alunos.map(a => getResumoAlunoSupervisao(a.matricula.matricula_id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  const atencao = resumos.filter(r => r.temAtencao).sort((a, b) => (a.statusAtencao === 'PRIORIDADE' ? -1 : 0) - (b.statusAtencao === 'PRIORIDADE' ? -1 : 0));
  const abertas = orientacoes.filter(o => ids.has(o.matricula_id) && o.status === 'ABERTA');
  const leituras = getLeiturasDoEncontro(turmaId, data);
  const nomeDe = (matriculaId: string) => alunos.find(a => a.matricula.matricula_id === matriculaId)?.aluno.nome || 'Estudante';

  return (
    <Janela titulo={`Preparar: ${turma?.nome || ''}`} subtitulo={`Aula de ${formatarDiaCurto(data)}`} aoFechar={fecharPreparar} largura="lg"
      rodape={<>
        <Botao onClick={fecharPreparar}>Fechar</Botao>
        {data <= hojeIso && <Botao variante="primario" icone={<Play className="w-4 h-4" />} onClick={() => { fecharPreparar(); abrirAula(turmaId, data); }}>Entrar na aula</Botao>}
      </>}>
      <div className="space-y-5">
        <section>
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2"><BookOpen className="w-5 h-5 text-violet-600" /> Leitura / estudo dirigido</h3>
          {leituras.length === 0 ? <p className="text-slate-500">Nada programado para esta aula.</p> : (
            <ul className="space-y-1.5">
              {leituras.map(l => (
                <li key={l.leitura_id} className="text-slate-800">
                  <strong>{l.tema}</strong>
                  {getResponsaveisLeitura(l).length > 0 && <span className="text-slate-600"> — {getResponsaveisLeitura(l).map(r => r.nome).join(', ')}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2"><UserRound className="w-5 h-5 text-amber-600" /> Precisam de atenção ({atencao.length})</h3>
          {atencao.length === 0 ? <p className="text-slate-500">Ninguém com alerta nesta turma.</p> : (
            <ul className="space-y-2">
              {atencao.slice(0, 10).map(r => (
                <li key={r.matricula.matricula_id} className="flex flex-wrap items-center gap-2">
                  <button onClick={() => { fecharPreparar(); abrirAluno(r.matricula.matricula_id); }} className="font-semibold text-slate-900 hover:underline cursor-pointer">{r.aluno.nome}</button>
                  {r.motivosAtencao.slice(0, 3).map(m => <Selo key={m} cor={r.statusAtencao === 'PRIORIDADE' ? 'vermelho' : 'ambar'}>{m}</Selo>)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2"><MessageSquare className="w-5 h-5 text-slate-500" /> Orientações para retomar ({abertas.length})</h3>
          {abertas.length === 0 ? <p className="text-slate-500">Nenhuma orientação em aberto.</p> : (
            <ul className="space-y-1.5">
              {abertas.slice(0, 8).map(o => (
                <li key={o.orientacao_id} className="text-slate-800"><strong>{nomeDe(o.matricula_id)}:</strong> {o.texto}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2"><ListOrdered className="w-5 h-5 text-slate-500" /> Fila de casos</h3>
          <FilaCasos turmaId={turmaId} semTitulo />
        </section>
      </div>
    </Janela>
  );
};
