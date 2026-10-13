import React, { useState } from 'react';
import { Archive, ArchiveRestore, Pencil, Play, Plus, Users } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { useNavegacao } from '../context/NavegacaoContext';
import { DIAS_SEMANA_NOMES, formatarDiaCurto } from '../services/supervisaoOperacionalService';
import type { Turma } from '../types';
import { TurmaFormModal } from '../components/TurmaFormModal';
import { Botao, Cartao, Selo, Vazio } from '../components/ui';

/** Lista de turmas do semestre: um cartão por turma com o que importa e o atalho para a aula. */
export const TurmasView: React.FC = () => {
  const { getTurmasDoPeriodo, getAlunosDaTurma, horariosTurma, pendencias, proximaSupervisao, supervisaoAtual, toggleArchiveTurma, periodoAtual, hojeIso, getRssDaTurma, disciplinas, getAulasDoDia } = useSupervisao();
  const { abrirTurma, abrirAula } = useNavegacao();
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const [editando, setEditando] = useState<Turma | null | undefined>(undefined);

  const turmas = getTurmasDoPeriodo(undefined, true).filter(t => (mostrarArquivadas ? t.status === 'ARQUIVADO' : t.status !== 'ARQUIVADO'));
  const arquivadas = getTurmasDoPeriodo(undefined, true).filter(t => t.status === 'ARQUIVADO').length;
  const aulaHoje = new Set(getAulasDoDia(hojeIso).filter(a => a.situacao === 'PREVISTA').map(a => a.turma.turma_id));

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Turmas</h1>
          <p className="text-slate-600">Semestre {periodoAtual?.nome}</p>
        </div>
        <div className="flex gap-2">
          {arquivadas > 0 && (
            <Botao variante="fantasma" onClick={() => setMostrarArquivadas(m => !m)}>
              {mostrarArquivadas ? 'Ver ativas' : `Arquivadas (${arquivadas})`}
            </Botao>
          )}
          <Botao variante="primario" icone={<Plus className="w-4 h-4" />} onClick={() => setEditando(null)}>Nova turma</Botao>
        </div>
      </header>

      {turmas.length === 0 ? (
        <Cartao><Vazio icone={<Users className="w-8 h-8" />} titulo={mostrarArquivadas ? 'Nenhuma turma arquivada' : 'Nenhuma turma neste semestre'} /></Cartao>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {turmas.map(t => {
            const alunos = getAlunosDaTurma(t.turma_id).length;
            const horario = horariosTurma.find(h => h.turma_id === t.turma_id && h.ativo);
            const nPend = pendencias.filter(p => p.turma_id === t.turma_id).length;
            const rss = getRssDaTurma(t.turma_id);
            const aoVivo = supervisaoAtual.emAndamento?.turma.turma_id === t.turma_id;
            const proxima = proximaSupervisao?.turma.turma_id === t.turma_id ? proximaSupervisao : null;
            return (
              <Cartao key={t.turma_id} className="p-4 flex flex-col gap-3">
                <button onClick={() => abrirTurma(t.turma_id)} className="text-left cursor-pointer">
                  <p className="text-lg font-bold text-slate-900">{t.nome}</p>
                  <p className="text-sm text-slate-600">
                    {disciplinas.find(d => d.disciplina_id === t.disciplina_id)?.codigo} ·{' '}
                    {horario && horario.dia_semana !== null ? `${DIAS_SEMANA_NOMES[Number(horario.dia_semana)]} ${horario.hora_inicio}–${horario.hora_fim}` : 'sem horário cadastrado'}
                  </p>
                </button>
                <div className="flex flex-wrap gap-1.5">
                  <Selo>{alunos} estudantes</Selo>
                  {rss.metricas.semanaAtual && <Selo cor="azul">Semana {rss.metricas.semanaTexto}</Selo>}
                  {rss.atrasadas.length > 0 && <Selo cor="ambar">RSS: {rss.atrasadas.length} atrasado(s)</Selo>}
                  {nPend > 0 && <Selo cor="vermelho">{nPend} pendência(s)</Selo>}
                  {proxima && <Selo cor="verde">próxima aula: {proxima.diasAte === 0 ? 'hoje' : formatarDiaCurto(proxima.dataProxima)}</Selo>}
                </div>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {aulaHoje.has(t.turma_id) && (
                    <Botao variante={aoVivo ? 'destaque' : 'primario'} tamanho="sm" icone={<Play className="w-4 h-4" />} onClick={() => abrirAula(t.turma_id, hojeIso)}>
                      {aoVivo ? 'Aula agora' : 'Aula de hoje'}
                    </Botao>
                  )}
                  <Botao variante={aulaHoje.has(t.turma_id) ? 'secundario' : 'primario'} tamanho="sm" onClick={() => abrirTurma(t.turma_id)}>Abrir turma</Botao>
                  <Botao variante="fantasma" tamanho="sm" icone={<Pencil className="w-4 h-4" />} onClick={() => setEditando(t)} aria-label="Editar turma" />
                  <Botao variante="fantasma" tamanho="sm" onClick={() => void toggleArchiveTurma(t.turma_id)}
                    icone={t.status === 'ARQUIVADO' ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    aria-label={t.status === 'ARQUIVADO' ? 'Reativar turma' : 'Arquivar turma'} title={t.status === 'ARQUIVADO' ? 'Reativar' : 'Arquivar'} />
                </div>
              </Cartao>
            );
          })}
        </div>
      )}

      {editando !== undefined && <TurmaFormModal turma={editando} aoFechar={() => setEditando(undefined)} />}
    </div>
  );
};
