import React from 'react';
import { AlertTriangle, ExternalLink, FileCheck2, RefreshCw, X } from 'lucide-react';
import { getAccessToken, OFFICIAL_SPREADSHEET_ID } from '../services/googleSheetsService';

type Linha = Record<string, string>;
type Aba = 'AVALIACOES' | 'FREQUENCIA' | 'CONFERENCIA';

function codigoTurma(nome: string): string {
  const n = nome.toLocaleLowerCase('pt-BR');
  if (n.includes('adulto')) return '1A';
  if (n.includes('infantojuvenil')) return '2A';
  if (n.includes('saúde mental no trabalho') || n.includes('trabalhador')) return '2B';
  if (n.includes('consultoria')) return '3B';
  if (n.includes('ampliada')) return n.includes('noturno') ? '3A Noturno' : '3A Matutino';
  return '';
}

function converterTabela(values: unknown[][]): Linha[] {
  const header = (values[0] || []).map(v => String(v ?? '').trim());
  return values.slice(1).map(row => Object.fromEntries(
    header.map((h, i) => [h, String(row[i] ?? '').trim()])
  )).filter(l => l.origem_id);
}

const tabelas = {
  notas: 'fonte_notas_parciais_2026',
  frequencia: 'fonte_freq_caderno_2026',
  pendencias: 'conciliacao_notas_2026',
};

async function carregarAba(aba: string, token: string): Promise<Linha[]> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' +
    OFFICIAL_SPREADSHEET_ID + '/values/' +
    encodeURIComponent("'" + aba + "'!A1:U950");
  const resposta = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(20000),
  });
  if (!resposta.ok) {
    throw new Error(resposta.status === 401
      ? 'O acesso ao Google expirou. Reconecte a conta em Ajustes.'
      : 'Não foi possível consultar os registros do caderno na planilha oficial.');
  }
  const payload = await resposta.json();
  return converterTabela(payload.values || []);
}

function statusVisivel(status: string): string {
  const nomes: Record<string, string> = {
    COINCIDE_COM_APP: 'Confere com a Central',
    DIVERGENCIA_DE_NOTA: 'Nota divergente — conferir',
    PENDENTE_VINCULO: 'Matrícula não vinculada',
    SEM_NOTA_NO_CADERNO: 'Sem nota no caderno',
    MARCA_NAO_NUMERICA: 'Marca não numérica',
    NOTA_SEM_CORRESPONDENTE: 'Nota sem lançamento na Central',
  };
  return nomes[status] || status || 'Sem informação';
}

export const NotasParciaisModal: React.FC<{
  turmaNome: string;
  onClose: () => void;
}> = ({ turmaNome, onClose }) => {
  const codigo = codigoTurma(turmaNome);
  const [aba, setAba] = React.useState<Aba>('AVALIACOES');
  const [loading, setLoading] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [dados, setDados] = React.useState<{
    notas: Linha[];
    frequencia: Linha[];
    pendencias: Linha[];
  }>({ notas: [], frequencia: [], pendencias: [] });

  const carregar = React.useCallback(async () => {
    if (!codigo) {
      setErro('Não foi possível associar a turma ao código do caderno. Nenhuma nota foi modificada.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Entre com sua conta Google para consultar a base da Central.');
      const [notas, frequencia, pendencias] = await Promise.all([
        carregarAba(tabelas.notas, token),
        carregarAba(tabelas.frequencia, token),
        carregarAba(tabelas.pendencias, token),
      ]);
      setDados({
        notas: notas.filter(x => x.turma_caderno === codigo),
        frequencia: frequencia.filter(x => x.turma_caderno === codigo),
        pendencias: pendencias.filter(x => x.turma === codigo),
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, [codigo]);

  React.useEffect(() => { void carregar(); }, [carregar]);

  const freqPorPessoa = React.useMemo(() => {
    const mapa = new Map<string, { nome: string; marcas: Record<string, string> }>();
    for (const f of dados.frequencia) {
      const key = f.numero || f.nome_caderno || f.origem_id;
      const atual = mapa.get(key) || { nome: f.nome_caderno || '', marcas: {} };
      atual.marcas[f.data_aula] = f.sinal_transcrito;
      mapa.set(key, atual);
    }
    return [...mapa.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(x => x[1]);
  }, [dados.frequencia]);
  const datas = React.useMemo(() => [...new Set(dados.frequencia.map(f => f.data_aula))]
    .filter(Boolean).sort(), [dados.frequencia]);
  const formatarData = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? s.slice(8, 10) + '/' + s.slice(5, 7) : s;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/60 p-2 sm:p-6 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Conferência do caderno de notas">
      <section className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[min(93vh,900px)] flex flex-col overflow-hidden">
        <header className="p-3 sm:p-5 border-b border-slate-200 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Caderno de notas parciais</h2>
            <p className="text-xs text-slate-600 mt-1">{turmaNome} · 2026.2 · Origem: PDF digitalizado</p>
            <p className="text-xs text-amber-800 mt-1">Somente leitura. Divergências e símbolos sem validação não alteram notas nem frequência oficial.</p>
          </div>
          <button onClick={onClose} aria-label="Fechar caderno" className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </header>
        <div className="p-3 sm:px-5 flex items-center gap-2 flex-wrap border-b border-slate-200">
          <button onClick={() => setAba('AVALIACOES')} className={'px-3 py-2 rounded-lg text-xs font-semibold ' + (aba === 'AVALIACOES' ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-700')}>Avaliações ({dados.notas.length})</button>
          <button onClick={() => setAba('FREQUENCIA')} className={'px-3 py-2 rounded-lg text-xs font-semibold ' + (aba === 'FREQUENCIA' ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-700')}>Frequência transcrita</button>
          <button onClick={() => setAba('CONFERENCIA')} className={'px-3 py-2 rounded-lg text-xs font-semibold ' + (aba === 'CONFERENCIA' ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-700')}>Conferências ({dados.pendencias.length})</button>
          <button onClick={() => void carregar()} disabled={loading} className="ml-auto px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-2"><RefreshCw className="w-4 h-4" />Atualizar</button>
        </div>
        {erro && <p className="m-4 p-3 rounded-lg bg-amber-50 text-amber-950 text-sm">{erro}</p>}
        {loading ? <p className="p-6 text-sm text-slate-600">Consultando a planilha oficial...</p> :
          <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-5">
            {aba === 'AVALIACOES' && <>
              <p className="text-xs text-slate-600 mb-3">A prova registrada no caderno é de 0 a 10. A coluna “Central” mostra o valor original cadastrado, não o peso de 2 pontos. Células vazias não são zero.</p>
              <table className="w-full min-w-[700px] text-xs text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100"><tr>{['Estudante','Prova no caderno','Prova na Central','Relatório parcial','Faltas anotadas','Situação'].map(t => <th key={t} className="p-2 border-b border-slate-200">{t}</th>)}</tr></thead>
                <tbody>{dados.notas.map(r => <tr key={r.origem_id} className="odd:bg-white even:bg-slate-50">
                  <td className="p-2 border-b border-slate-100 font-semibold">{r.nome_cadastro_app || r.nome_transcrito}</td>
                  <td className="p-2 border-b border-slate-100">{r.nota_prova_original || '—'}</td>
                  <td className="p-2 border-b border-slate-100">{r.valor_prova_app_original || '—'}</td>
                  <td className="p-2 border-b border-slate-100">{r.relatorio_parcial_marcacao || '—'}</td>
                  <td className="p-2 border-b border-slate-100">{r.total_faltas_caderno || '—'}</td>
                  <td className={'p-2 border-b border-slate-100 ' + (r.situacao_conciliacao === 'COINCIDE_COM_APP' ? 'text-teal-800' : 'font-semibold text-amber-800')}>{statusVisivel(r.situacao_conciliacao)}</td>
                </tr>)}</tbody>
              </table>
            </>}
            {aba === 'FREQUENCIA' && <>
              <p className="text-xs text-amber-900 mb-3">Atenção: “·”, “/”, “X”, “J” e “F” são sinais transcritos da foto, não uma chamada homologada. Não calculam presença, faltas ou assiduidade no aplicativo.</p>
              <div className="overflow-x-auto"><table className="min-w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100"><tr><th className="p-2 text-left border-b">Estudante</th>{datas.map(d => <th key={d} className="p-2 border-b whitespace-nowrap">{formatarData(d)}</th>)}</tr></thead>
                <tbody>{freqPorPessoa.map((f,i) => <tr key={i} className="even:bg-slate-50">
                  <td className="p-2 border-b border-slate-100 min-w-44">{f.nome}</td>
                  {datas.map(d => <td key={d} className="p-2 border-b border-slate-100 text-center">{f.marcas[d] || '—'}</td>)}
                </tr>)}</tbody>
              </table></div>
            </>}
            {aba === 'CONFERENCIA' && <>
              <p className="text-xs text-slate-600 mb-3">Nenhuma das pendências abaixo modifica o cadastro ou uma nota validada. Conferir o PDF e o vínculo da matrícula antes de resolver.</p>
              {dados.pendencias.length === 0 && <div className="flex items-center gap-2 text-teal-800 text-sm"><FileCheck2 className="w-5 h-5" />Sem divergências registradas nesta turma.</div>}
              {dados.pendencias.map(p => <article key={p.origem_id} className="border border-amber-200 rounded-xl p-3 mb-3">
                <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-700" />{p.nome_transcrito}</h3>
                <p className="text-xs text-slate-700 mt-2">{statusVisivel(p.situacao)} · Prova no caderno: {p.prova_caderno || 'sem lançamento'} · Na Central: {p.prova_app || 'sem lançamento'}</p>
                <p className="text-xs text-slate-600 mt-1">{p.acao_recomendada}</p>
              </article>)}
            </>}
          </div>}
        <footer className="border-t border-slate-200 p-3 sm:px-5 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">Fonte de conferência — nunca substitui lançamento oficial.</span>
          <a className="text-xs font-bold text-teal-800 flex items-center gap-1" href={'https://docs.google.com/spreadsheets/d/' + OFFICIAL_SPREADSHEET_ID + '/edit'} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" />Abrir planilha</a>
        </footer>
      </section>
    </div>
  );
};
