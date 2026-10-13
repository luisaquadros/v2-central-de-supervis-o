import { valorConfiguracaoVisivel } from '../services/configuracoesSeguras';
import { lerCentralControleSomenteLeitura, type DiagnosticoCentralControle } from '../services/centralControleDiagnostico';
import { BackupPainel } from '../components/BackupPainel';
import { AcessoPainel } from '../components/AcessoPainel';
import React, { useState } from 'react';
import {
  Settings,
  Download,
  Upload,
  RefreshCw,
  Code2,
  Copy,
  Check,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Layers,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';

export const ConfiguracoesView: React.FC = () => {
  const {
    criterios,
    configuracoes,
    importarAlunosLote,
    turmas,
    alunos,
    matriculas,
    entregas,
    connectionStatus,
    saveStatus,
    spreadsheetId,
    spreadsheetName,
    spreadsheetUrl,
    itensOperacionaisLocaisPendentes,
    importarItensOperacionaisLocais,
  } = useSupervisao();

  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'importar'>('geral');
  const [importandoFila, setImportandoFila] = useState(false);
  const [testandoConector,setTestandoConector] = useState(false);
  const [conectorDiagnostico,setConectorDiagnostico] = useState<DiagnosticoCentralControle|null>(null);
  const [conectorErro,setConectorErro] = useState<string|null>(null);

  // Import state
  const [selectedTurmaImport, setSelectedTurmaImport] = useState(
    turmas.length > 0 ? turmas[0].turma_id : ''
  );
  const [importText, setImportText] = useState(
    'Ana Clara Vieira\tRA202616\nBruno Henrique Lima\tRA202617\nCamila Duarte\tRA202618'
  );
  const [importResult, setImportResult] = useState<{ adicionados: number; duplicados: number } | null>(
    null
  );


  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim() || !selectedTurmaImport) return;

    const lines = importText.split('\n');
    const parsedList: { nome: string; identificador_academico: string }[] = [];

    lines.forEach(line => {
      const parts = line.split(/[\t,;]/);
      if (parts.length >= 1 && parts[0].trim()) {
        const nome = parts[0].trim();
        const ra = parts.length > 1 ? parts[1].trim() : `RA${Date.now()}`;
        parsedList.push({ nome, identificador_academico: ra });
      }
    });

    const result = await importarAlunosLote(selectedTurmaImport, parsedList);
    setImportResult(result);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Configurações & Conexão Google Sheets</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Conexão direta com a planilha oficial pelo Google Sheets (login Google)
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto shadow-xs">
        <div className="flex items-center gap-1 min-w-max">
          <button
            onClick={() => setActiveSubTab('geral')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'geral'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Visão Geral & Parâmetros
          </button>
          <button
            onClick={() => setActiveSubTab('importar')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'importar'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Importar Alunos
          </button>
        </div>
      </div>

      {/* 1. ABA GERAL */}
      {activeSubTab === 'geral' && (
        <div className="space-y-5 text-xs">
          {/* Status da Conexão */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Status do Ambiente</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Ambiente Ativo</span>
                <span className="font-bold text-slate-900">
                  {connectionStatus === 'CONECTADO' ? 'Aplicativo web (Cloudflare)' : 'Sem conexão com a planilha'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Canal de Comunicação</span>
                <span className="font-mono font-bold text-slate-900">Google Sheets API + coordenador de escrita</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Segurança e Acesso</span>
                <span className="font-bold text-emerald-700">Login Google (acesso da conta à planilha)</span>
              </div>
            </div>
          </div>

          {/* Base de Dados Oficial Conectada */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Base de Dados Oficial Conectada</h3>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                30 Tabelas Normalizadas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Nome da Planilha</span>
                <span className="font-bold text-slate-900">{spreadsheetName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Spreadsheet ID</span>
                <span className="font-mono font-semibold text-slate-800 text-[11px] break-all">{spreadsheetId}</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between">
              <span>Consumo restrito às tabelas normalizadas. Abas-fonte e backups protegidos contra escrita.</span>
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-900 underline font-semibold hover:text-slate-700 shrink-0 ml-2"
              >
                Abrir Planilha Oficial
              </a>
            </div>
          </div>

          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Central de Controle — diagnóstico de integração</h3>
            <p className="text-xs text-slate-600">Consulta somente leitura da planilha original. Não copia, corrige ou sobrescreve alunos, documentos ou RSS.</p>
            <button type="button" disabled={testandoConector} onClick={async()=>{
              setTestandoConector(true);setConectorErro(null);
              try { setConectorDiagnostico(await lerCentralControleSomenteLeitura(turmas,matriculas,alunos,entregas)); }
              catch(e:any){setConectorErro(e?.message||'Falha na leitura da fonte original.');}
              finally {setTestandoConector(false);}
            }} className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-50">
              {testandoConector?'Comparando registros...':'Conferir integração sem alterar dados'}
            </button>
            {conectorErro&&<p role="alert" className="text-xs text-red-700">{conectorErro}</p>}
            {conectorDiagnostico&&<div role="status" className="text-xs space-y-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p><strong>Registros:</strong> {conectorDiagnostico.lidos} na fonte; {conectorDiagnostico.vinculados} vinculados.</p>
              <p><strong>Exigem conferência:</strong> {conectorDiagnostico.naoVinculados} sem matrícula; {conectorDiagnostico.ambiguos} ambíguos; {conectorDiagnostico.turmasDesconhecidas} turmas não mapeadas.</p>
              <p><strong>Diferenças documentais:</strong> {conectorDiagnostico.divergenciasDocumentais} status divergentes ou ausentes.</p>
              <p><strong>IMPORTRANGE:</strong> {conectorDiagnostico.pendenteAutorizacaoRegistroSemanal?'autorização pendente na C3 da fonte':'nenhum erro #REF! detectado em C3'}.</p>
              <p className="font-semibold text-amber-800">Importação automática bloqueada até homologar vínculos e diferenças.</p>
            </div>}
          </section>

          {/* Tabela Oficial configuracoes da Base */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Parâmetros do Sistema (Tabela configuracoes)</h3>
                <p className="text-[11px] text-slate-500">Chaves e valores registrados na aba normalizada da base</p>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Total: {configuracoes.length}</span>
            </div>

            {configuracoes.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-slate-500 text-xs">
                Nenhuma configuração personalizada registrada na base. As diretrizes padrão do semestre estão ativas.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {configuracoes.map((cfg, idx) => (
                  <div key={cfg.configuracao_id || idx} className="p-3 flex items-center justify-between bg-white text-xs">
                    <div>
                      <span className="font-mono font-bold text-slate-800">{cfg.chave || 'CHAVE_SEM_NOME'}</span>
                      {(cfg.turma_id || cfg.disciplina_id) && (
                        <span className="text-[10px] text-slate-400 ml-2">
                          {cfg.turma_id ? `Turma: ${cfg.turma_id}` : `Disciplina: ${cfg.disciplina_id}`}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono text-[11px]">
                      {valorConfiguracaoVisivel(cfg.chave, cfg.valor)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Governança Acadêmica e Regras Institucionais */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Governança Acadêmica & Regras Institucionais (Somente Leitura)
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tabelas como <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">regras_rss</code>, <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">regras_prazo</code>, <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">contrato_app</code> e <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">dicionario_dados</code> contêm diretrizes normativas da coordenação acadêmica. Elas são gerenciadas exclusivamente na planilha oficial do Google Sheets e <strong>não podem ser modificadas como preferências comuns pelo aplicativo</strong> para garantir a integridade dos dados e o cumprimento das normas pedagógicas.
            </p>
          </div>

          {/* Critérios de Avaliação Ativos */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Critérios de Avaliação do Semestre</h3>
              <span className="text-slate-400">Total: {criterios.length} critérios</span>
            </div>
            {criterios.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-slate-500 text-xs">
                Nenhum critério de avaliação registrado na base oficial.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {criterios.map(c => {
                  const notaMax = Number(c.nota_maxima || 0);
                  return (
                    <div key={c.criterio_id} className="p-3 flex items-center justify-between bg-white">
                      <div>
                        <span className="font-bold text-slate-800">{c.nome}</span>
                        {c.ordem !== undefined && c.ordem !== null && (
                          <span className="text-slate-400 ml-2">Ordem {c.ordem}</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        Nota Máx: {notaMax.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Sincronização de tarefas antigas</h3>
            <p className="text-xs text-slate-600">Novas tarefas, fila de supervisão e caixa de entrada são registradas na planilha. Itens criados antes desta versão podem existir apenas neste dispositivo. Nenhum registro local será apagado.</p>
            <p className="text-sm font-semibold text-slate-800">{itensOperacionaisLocaisPendentes} item(ns) locais ainda sem cópia confirmada na base.</p>
            <button type="button" disabled={importandoFila || itensOperacionaisLocaisPendentes === 0}
              onClick={async () => {
                if (!window.confirm('Enviar os itens locais antigos deste dispositivo para a planilha? Não apaga nenhum item.')) return;
                setImportandoFila(true);
                try {
                  const quantos = await importarItensOperacionaisLocais();
                  window.alert(quantos + ' item(ns) enviados. Sincronize novamente para conferir.');
                } catch (e: any) { window.alert(e?.message || 'Não foi possível sincronizar os itens antigos.'); }
                finally { setImportandoFila(false); }
              }}
              className="min-h-[44px] px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
              {importandoFila ? 'Enviando...' : 'Enviar itens antigos deste dispositivo'}
            </button>
          </section>

          <AcessoPainel />
          <BackupPainel />
        </div>
      )}

      {/* 5. ABA: IMPORTAR ALUNOS */}
      {activeSubTab === 'importar' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Importação em Lote de Alunos</h3>
            <p className="text-slate-500">
              Cole a lista de estudantes a partir do Excel, Google Sheets ou arquivo separado por tabulação/vírgula.
            </p>
          </div>

          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Turma de Destino
              </label>
              <select
                value={selectedTurmaImport}
                onChange={e => setSelectedTurmaImport(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 font-medium"
              >
                {turmas.map(t => (
                  <option key={t.turma_id} value={t.turma_id}>
                    {t.nome} ({t.turno})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Dados dos Alunos (Nome [TAB ou vírgula] RA)
              </label>
              <textarea
                rows={6}
                value={importText}
                onChange={e => setImportText(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-3 bg-slate-50 font-mono text-xs placeholder:text-slate-400"
                placeholder="Exemplo:\nMariana Silva\tRA202620\nPedro Henrique\tRA202621"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Importar Alunos para a Turma</span>
            </button>
          </form>

          {importResult && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Importação Concluída com Sucesso!</span>
              </div>
              <p>
                <strong>{importResult.adicionados}</strong> aluno(s) adicionados à turma.
                {importResult.duplicados > 0 && (
                  <span> ({importResult.duplicados} já matriculados ignorados).</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
