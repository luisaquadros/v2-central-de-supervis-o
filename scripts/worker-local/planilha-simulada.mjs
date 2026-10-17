// Planilha + Drive + token Google SIMULADOS (somente loopback). Estado em memória; imprime em arquivo o que recebeu.
// Nada aqui usa dados reais: ids e nomes são sintéticos.
import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
const porta = Number(process.argv[2]), jwksArquivo = process.argv[3], estadoArquivo = process.argv[4];
const hoje = Date.now(), dh = n => new Date(hoje - n * 86_400_000).toISOString();
const CAB_MON = ['monitoramento_id','periodo_id','turma_id','titular_tipo','titular_id','tipo_documento_id','arquivo_id','pasta_id','data_modificacao_drive','consultado_em','status','origem_metadado','validacao_manual','erro_codigo','observacao_manual'];
const inicial = () => ({
  orientacoes: [['orientacao_id','matricula_id','descricao','status','data_orientacao'], ['o1','m1','texto reservado','ABERTA','13/10/2026']],
  turmas: [['turma_id','nome'], ['t2b','2B'], ['t3b','3B']],
  matriculas: [['matricula_id','aluno_id','turma_id','papel_na_turma'], ['mA','a1','t2b','SUPERVISAO_HORARIO_ALTERNATIVO'], ['mB','a1','t3b','SUPERVISAO_HORARIO_ALTERNATIVO'], ['mC','a2','t3b','']],
  alunos: [['aluno_id','nome','email'], ['a1','Estudante 1','e1@exemplo.com'], ['a2','Estudante 2','e2@exemplo.com']],
  frequencias: [['frequencia_id','matricula_id','data_aula','status','justificativa'], ['f1','mA','2026-10-13','PRESENTE','atestado'], ['f2','mC','2026-10-13','PRESENTE','']],
  avaliacoes: [['avaliacao_id','matricula_id','nota'], ['v1','mA',8]],
  grupos_pratica: [['grupo_id','turma_id']],
  monitoramento_documentos: [CAB_MON,
    ['m1','p','t2b','MATRICULA','mA','DIARIO_CAMPO','arqA','pasta1','','','','CADASTRO_MANUAL','conferido','','observação minha'],
    ['m2','p','t3b','MATRICULA','mB','DIARIO_CAMPO','arqB','pasta2','','','','CADASTRO_MANUAL','','',''],
    ['m3','p','t3b','MATRICULA','mC','DIARIO_CAMPO','arqC','pasta3','','','','CADASTRO_MANUAL','','',''],
    ['m4','p','t3b','MATRICULA','mC','DIARIO_CAMPO_2','arqD','pasta3','','','','CADASTRO_MANUAL','','','']],
  sincronizacao: [['fonte','arquivo_origem','aba_origem','modo','status_conexao','observacao','status_integracao','registros_lidos','registros_atualizados','mensagem_erro']],
});
const driveBase = () => ({
  arqA: [200, { id: 'arqA', modifiedTime: dh(2), trashed: false, parents: ['pasta1'] }],
  arqB: [200, { id: 'arqB', modifiedTime: dh(30), trashed: false, parents: ['pasta2'] }],
  arqC: [403, { error: { code: 403 } }],
  arqD: [404, { error: { code: 404 } }],
});
let abas = inicial(), drive = driveBase(), usos = [], consultasDrive = [], atrasoDrive = 0, tokens = 0;
const salvar = () => writeFileSync(estadoArquivo, JSON.stringify({ ...abas, __usos: usos, __drive: consultasDrive, __tokens: tokens }));
salvar();
const ler = req => new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); });
const enviar = (res, d, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); };
http.createServer(async (req, res) => {
  const u = decodeURIComponent(req.url), corpo = await ler(req);
  if (u.startsWith('/__reset')) { abas = inicial(); drive = driveBase(); usos = []; consultasDrive = []; tokens = 0; atrasoDrive = Number(new URL(req.url, 'http://x').searchParams.get('atrasoDrive') || 0); salvar(); return enviar(res, { ok: true }); }
  if (u.startsWith('/jwks')) return enviar(res, JSON.parse(readFileSync(jwksArquivo, 'utf8')));
  if (u.startsWith('/token')) { tokens++; salvar(); return enviar(res, { access_token: 'token-conta-servico', expires_in: 3600, token_type: 'Bearer' }); }
  const auth = req.headers.authorization;
  if (u.startsWith('/drive/v3/files/')) {
    if (auth !== 'Bearer token-conta-servico') return enviar(res, {}, 401);
    const id = u.split('/drive/v3/files/')[1].split('?')[0]; consultasDrive.push(u);
    if (atrasoDrive) await new Promise(r => setTimeout(r, atrasoDrive));
    salvar(); const d = drive[id]; return d ? enviar(res, d[1], d[0]) : enviar(res, { error: { code: 404 } }, 404);
  }
  if (auth !== 'Bearer token-google-teste' && auth !== 'Bearer token-conta-servico') return enviar(res, {}, 401);
  usos.push(auth.replace('Bearer ', '')); 
  const aba = u.match(/values\/'([^'!]+)'/)?.[1];
  if (u.includes('fields=sheets')) return enviar(res, { sheets: Object.keys(abas).map((t, i) => ({ properties: { title: t, sheetId: i + 1 } })) });
  if (req.method === 'GET' && u.includes('/values:batchGet')) { const nomes = [...u.matchAll(/ranges='([^'!]+)'/g)].map(x => x[1]); salvar(); return enviar(res, { valueRanges: nomes.map(n => ({ range: n, values: abas[n] ?? [] })) }); }
  if (req.method === 'POST' && u.includes('/values:batchUpdate')) {
    for (const p of JSON.parse(corpo).data) { const [, c, l] = p.range.match(/!([A-Z]+)(\d+)$/); abas[p.range.match(/^'([^']+)'/)[1]][Number(l) - 1][[...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1] = p.values[0][0]; }
    salvar(); return enviar(res, {});
  }
  if (req.method === 'POST' && u.endsWith(':batchUpdate')) { const a = JSON.parse(corpo).requests?.[0]?.addSheet; if (a) abas[a.properties.title] = []; salvar(); return enviar(res, {}); }
  if (req.method === 'PUT' && aba) { abas[aba][0] = JSON.parse(corpo).values[0]; salvar(); return enviar(res, {}); }
  if (req.method === 'POST' && u.includes(':append?') && aba) { (abas[aba] ??= []).push(JSON.parse(corpo).values[0]); salvar(); return enviar(res, {}); }
  if (aba) { salvar(); return enviar(res, { values: abas[aba] ?? [] }); }
  enviar(res, { erro: 'rota ' + req.method + ' ' + u }, 404);
}).listen(porta, '127.0.0.1', () => console.log('mock pronto', porta));
