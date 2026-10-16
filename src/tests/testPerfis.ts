import { strict as assert } from 'node:assert';
import { lerConfiguracaoAcessos, resolverPerfil, podeEscreverTabela, turmaPermitida, turmaDoRegistro, filtrarLeitura, tabelaLegivelPor, LEITURA_MONITORA } from '../server/acessos';
import { tokenContaServico, limparCacheContaServico, ContaServicoIndisponivel, urlDoToken } from '../server/contaServico';
import { criarContaServicoDeTeste } from './ajudaContaServico';
import { criarAmbiente } from './ajudaAmbiente';

// ---------- configuração e perfis ----------
{
  const c = lerConfiguracaoAcessos({
    ADMIN_EMAILS: 'Professora@Exemplo.com',
    ACESSOS_JSON: JSON.stringify({ monitoras: [
      { email: 'Monitora@Exemplo.com', turmas: ['t2b'], operacoes: ['CHAMADA', 'NOTAS', 'ENTREGAS'] },
      { email: 'sem-turma@x.com', turmas: [], operacoes: ['CHAMADA'] },
      { email: 'curinga@x.com', turmas: ['*'], operacoes: ['CHAMADA'] },
      { email: 'sem-operacao@x.com', turmas: ['t2b'], operacoes: ['NOTAS'] },
      { email: 'invalido', turmas: ['t2b'], operacoes: ['CHAMADA'] },
    ] }),
  });
  assert.deepEqual([...c.administradoras], ['professora@exemplo.com']);
  assert.deepEqual([...c.monitoras.keys()], ['monitora@exemplo.com'], 'só monitora completa; "*", sem turma, sem operação válida e e-mail inválido são ignorados');
  assert.deepEqual(c.monitoras.get('monitora@exemplo.com'), { turmas: ['t2b'], operacoes: ['CHAMADA', 'ENTREGAS'] }, 'operação desconhecida (NOTAS) não existe');
  assert(c.avisos.length >= 4);
  assert.equal(lerConfiguracaoAcessos({ ADMIN_EMAILS: 'a@x.com', ACESSOS_JSON: '{lixo' }).monitoras.size, 0, 'JSON inválido não habilita ninguém');
  assert(lerConfiguracaoAcessos({ ACESSOS_JSON: '{lixo' }).avisos.some(a => /inválido/.test(a)));
  assert.equal(resolverPerfil('PROFESSORA@exemplo.com', c)!.papel, 'PROFESSORA_ADMIN');
  assert.equal(resolverPerfil('monitora@exemplo.com', c)!.papel, 'MONITORA');
  assert.equal(resolverPerfil('aluna@exemplo.com', c), null, 'sem acesso estudantil');
  const dupla = lerConfiguracaoAcessos({ ADMIN_EMAILS: 'm@x.com', ACESSOS_JSON: JSON.stringify({ monitoras: [{ email: 'm@x.com', turmas: ['t1'], operacoes: ['CHAMADA'] }] }) });
  assert.equal(resolverPerfil('m@x.com', dupla)!.papel, 'PROFESSORA_ADMIN', 'administradora prevalece');
}

// ---------- escrita: o que uma monitora NUNCA grava ----------
{
  const m = { papel: 'MONITORA' as const, email: 'm@x.com', turmas: ['t2b'], operacoes: ['CHAMADA' as const] };
  for (const t of ['frequencias', 'encontros_turma']) assert.equal(podeEscreverTabela(m, t, 'UPDATE').ok, true, t);
  for (const t of ['entregas', 'avaliacoes', 'avaliacoes_completas', 'criterios_avaliacao', 'ocorrencias', 'feedbacks', 'feedback_alunos', 'registros_supervisao', 'orientacoes',
    'pontos_acompanhamento', 'preparacoes_aula', 'alunos', 'matriculas', 'turmas', 'horarios_turma', 'configuracoes', 'log_alteracoes', 'monitoramento_documentos', 'sincronizacao', 'documentos'])
    assert.equal(podeEscreverTabela(m, t, 'UPDATE').ok, false, `${t} não é delegável`);
  assert.equal(podeEscreverTabela(m, 'frequencias', 'DELETE').ok, false, 'monitora não exclui');
  assert.equal(podeEscreverTabela({ ...m, operacoes: ['ENTREGAS'] }, 'entregas', 'INSERT').ok, true);
  assert.equal(podeEscreverTabela({ ...m, operacoes: ['ENTREGAS'] }, 'frequencias', 'INSERT').ok, false, 'delegação de uma operação não vale para outra');
  assert.equal(podeEscreverTabela({ ...m, operacoes: ['DOCUMENTOS_VER'] }, 'monitoramento_documentos', 'UPDATE').ok, false, 'ver documentos não é gravar');
  const adm = { papel: 'PROFESSORA_ADMIN' as const, email: 'a@x.com', turmas: ['*'], operacoes: [] };
  assert.equal(podeEscreverTabela(adm, 'avaliacoes', 'DELETE').ok, true);
  assert.equal(turmaPermitida(m, 't2b').ok, true);
  assert.equal((turmaPermitida(m, 't3b') as any).code, 'FORA_DA_TURMA');
  assert.equal((turmaPermitida(m, undefined) as any).code, 'TURMA_INDETERMINADA', 'turma desconhecida = negado');
  assert.equal(turmaDoRegistro({ matricula_id: 'm9' }, id => (id === 'm9' ? 't2b' : undefined)), 't2b');
  assert.equal(turmaDoRegistro({ matricula_id: 'x' }, () => undefined), undefined);
  assert.equal(turmaDoRegistro({ turma_id: 't3b', matricula_id: 'm9' }, () => 't2b'), 't3b', 'turma_id explícito prevalece');
}

// ---------- leitura filtrada ----------
const tab = (cab: string[], ...linhas: unknown[][]) => [cab, ...linhas];
const dados = {
  turmas: tab(['turma_id', 'nome'], ['t2b', '2B'], ['t3b', '3B'], ['t9', 'Outra']),
  matriculas: tab(['matricula_id', 'aluno_id', 'turma_id', 'papel_na_turma'], ['mA', 'a1', 't2b', ''], ['mB', 'a1', 't3b', 'SUPERVISAO_HORARIO_ALTERNATIVO'], ['mC', 'a2', 't9', ''], ['mD', 'a3', 't2b', 'REPRESENTANTE']),
  alunos: tab(['aluno_id', 'nome', 'email'], ['a1', 'Estudante 1', 'e1@x.com'], ['a2', 'Estudante 2', 'e2@x.com'], ['a3', 'Estudante 3', 'e3@x.com']),
  frequencias: tab(['frequencia_id', 'matricula_id', 'data_aula', 'status', 'justificativa', 'observacao'], ['f1', 'mA', '2026-10-13', 'PRESENTE', 'atestado médico', 'x'], ['f2', 'mC', '2026-10-13', 'PRESENTE', '', ''], ['f3', 'mB', '2026-10-14', 'PRESENTE', '', '']),
  grupos_pratica: tab(['grupo_id', 'turma_id'], ['g1', 't2b'], ['g2', 't9']),
  grupo_integrantes: tab(['grupo_integrante_id', 'grupo_id', 'matricula_id'], ['i1', 'g1', 'mA'], ['i2', 'g2', 'mC']),
};
const ctx = (d = dados) => ({
  matriculas: d.matriculas.slice(1).map(l => Object.fromEntries(d.matriculas[0].map((c, i) => [c, l[i]]))),
  grupos: d.grupos_pratica.slice(1).map(l => Object.fromEntries(d.grupos_pratica[0].map((c, i) => [c, l[i]]))),
});
{
  const m2b = { papel: 'MONITORA' as const, email: 'm@x.com', turmas: ['t2b'], operacoes: ['CHAMADA' as const] };
  const ids = (v: unknown[][] | null, c = 0) => (v ?? []).slice(1).map(l => l[c]);
  assert.deepEqual(ids(filtrarLeitura('turmas', dados.turmas, m2b, ctx())), ['t2b'], 'só a turma delegada');
  assert.deepEqual(ids(filtrarLeitura('matriculas', dados.matriculas, m2b, ctx())), ['mA', 'mD'], 'a matrícula 3B do mesmo aluno não aparece para a monitora da 2B');
  const alunos = filtrarLeitura('alunos', dados.alunos, m2b, ctx())!;
  assert.deepEqual(ids(alunos), ['a1', 'a3'], 'só alunos matriculados na turma delegada'); assert(!alunos[0].includes('email'), 'e-mail oculto');
  const freq = filtrarLeitura('frequencias', dados.frequencias, m2b, ctx())!;
  assert.deepEqual(ids(freq, 0), ['f1'], 'frequência só da turma'); assert(!freq[0].includes('justificativa') && !freq[0].includes('observacao'), 'justificativas ocultas');
  assert(!JSON.stringify(freq).includes('atestado'), 'texto de justificativa nunca chega à monitora');
  assert.deepEqual(ids(filtrarLeitura('grupo_integrantes', dados.grupo_integrantes, m2b, ctx())), ['i1']);
  // tabelas confidenciais: negadas por completo
  for (const t of ['avaliacoes', 'avaliacoes_completas', 'ocorrencias', 'feedbacks', 'feedback_alunos', 'registros_supervisao', 'registros_semanais', 'orientacoes', 'criterios_avaliacao', 'configuracoes', 'log_alteracoes', 'documentos', 'fonte_notas_parciais_2026'])
    assert.equal(filtrarLeitura(t, [['x']], m2b, ctx()), null, `${t} é confidencial`);
  assert.equal(filtrarLeitura('entregas', [['matricula_id']], m2b, ctx()), null, 'entregas exige a operação ENTREGAS');
  assert.equal(filtrarLeitura('monitoramento_documentos', [['turma_id']], m2b, ctx()), null, 'documentos exige DOCUMENTOS_VER');
  assert.equal(tabelaLegivelPor({ ...m2b, operacoes: ['ENTREGAS'] }, 'entregas'), true);
  const autorizadaParaDocumentos = { ...m2b, operacoes: ['DOCUMENTOS_VER' as const] };
  const documentosFiltrados = filtrarLeitura('monitoramento_documentos',
    tab(['monitoramento_id', 'turma_id', 'status', 'arquivo_id', 'pasta_id', 'observacao_administrativa', 'coluna_nova'],
      ['d1', 't2b', 'NAO_VERIFICADO', 'id-arquivo-interno', 'id-pasta-interna', 'informacao-privada', 'novo-campo-privado'],
      ['d2', 't9', 'NAO_VERIFICADO', 'outro-arquivo', 'outra-pasta', 'outro-dado', 'outra-coluna']),
    autorizadaParaDocumentos, ctx())!;
  assert.deepEqual(documentosFiltrados[0], ['monitoramento_id', 'turma_id', 'status'],
    'monitora recebe apenas metadados explicitamente autorizados');
  assert.equal(documentosFiltrados.length, 2, 'a turma alheia fica oculta');
  assert(!JSON.stringify(documentosFiltrados).includes('informacao-privada'));
  assert(!JSON.stringify(documentosFiltrados).includes('id-arquivo-interno'));
  assert(!JSON.stringify(documentosFiltrados).includes('novo-campo-privado'));
  const alunosComColunaExtra = filtrarLeitura('alunos',
    tab(['aluno_id', 'nome', 'email', 'novo_campo'], ['a1', 'Pessoa 1', 'email-interno', 'dado-extra']),
    m2b, ctx())!;
  assert.deepEqual(alunosComColunaExtra[0], ['aluno_id', 'nome']);
  assert(!JSON.stringify(alunosComColunaExtra).includes('dado-extra'));

  // sem coluna de vínculo não há como provar a turma: nada é liberado
  assert.deepEqual(filtrarLeitura('turmas', tab(['nome'], ['2B'], ['3B']), m2b, ctx()), [['nome']]);
  // Exceções AUDITADAS (testContribuicaoMonitora): definição da rubrica (sem notas) e as PRÓPRIAS contribuições preliminares da monitora.
  const EXCECOES_AUDITADAS = new Set(['rubricas_avaliacao', 'evidencias_avaliacao', 'registros_semanais', 'rss_ajustes']);
  for (const t of Object.keys(LEITURA_MONITORA)) assert(EXCECOES_AUDITADAS.has(t) || !/aval|ocorr|feedback|supervisao|semanais|orienta/.test(t), `${t} não pode estar na lista de leitura`);
  // RSS: só por LISTA BRANCA de colunas administrativas (testRssMonitora)
  assert(LEITURA_MONITORA.registros_semanais.somente && !LEITURA_MONITORA.registros_semanais.somente.some(c => /objetiv|tecnic|manejo|compreens|proximo|prioridade|duvida|limita|responsavel_nome|observ/.test(c)));
  assert.deepEqual(LEITURA_MONITORA.rubricas_avaliacao.operacao, 'CONTRIBUICAO_AVALIATIVA');
  assert.deepEqual(LEITURA_MONITORA.evidencias_avaliacao.operacao, 'CONTRIBUICAO_AVALIATIVA');
  const adm = { papel: 'PROFESSORA_ADMIN' as const, email: 'a@x.com', turmas: ['*'], operacoes: [] };
  assert.equal(filtrarLeitura('alunos', dados.alunos, adm, ctx())!.length, 4, 'administradora vê tudo');
}

// ---------- conta de serviço: assinatura JWT conferida com a chave pública ----------
{
  limparCacheContaServico();
  const cs = await criarContaServicoDeTeste();
  let corpo = '';
  const falso = (async (_u: any, init: any) => { corpo = String(init.body); return new Response(JSON.stringify({ access_token: 'tk-1', expires_in: 3600 }), { status: 200 }); }) as typeof fetch;
  const tk = await tokenContaServico({ GOOGLE_SERVICE_ACCOUNT_JSON: cs.json }, ['escopo-a', 'escopo-b'], 1_000_000_000_000, falso);
  assert.equal(tk, 'tk-1');
  const p = new URLSearchParams(corpo); assert.equal(p.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  const [h, c, s] = p.get('assertion')!.split('.');
  const dec = (x: string) => JSON.parse(Buffer.from(x, 'base64url').toString());
  assert.equal(dec(h).alg, 'RS256'); assert.equal(dec(c).iss, cs.email); assert.equal(dec(c).scope, 'escopo-a escopo-b'); assert.equal(dec(c).aud, 'https://oauth2.googleapis.com/token');
  assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cs.publica, Buffer.from(s, 'base64url'), new TextEncoder().encode(h + '.' + c)), true, 'assinatura confere com a chave pública');
  corpo = ''; assert.equal(await tokenContaServico({ GOOGLE_SERVICE_ACCOUNT_JSON: cs.json }, ['escopo-b', 'escopo-a'], 1_000_000_000_000 + 1000, falso), 'tk-1'); assert.equal(corpo, '', 'token em cache');
  limparCacheContaServico();
  await assert.rejects(() => tokenContaServico({}, ['x']), (e: any) => e instanceof ContaServicoIndisponivel && e.code === 'NAO_CONFIGURADA');
  await assert.rejects(() => tokenContaServico({ GOOGLE_SERVICE_ACCOUNT_JSON: '{lixo' }, ['x']), (e: any) => e.code === 'CHAVE_INVALIDA');
  await assert.rejects(() => tokenContaServico({ GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'a@b', private_key: 'nao-e-chave' }) }, ['y']), (e: any) => e.code === 'CHAVE_INVALIDA');
  await assert.rejects(() => tokenContaServico({ GOOGLE_SERVICE_ACCOUNT_JSON: cs.json }, ['z'], Date.now(), (async () => new Response('', { status: 400 })) as typeof fetch), (e: any) => e.code === 'TOKEN_RECUSADO');
  assert.equal(urlDoToken({ TOKEN_URL: 'https://evil.example/token' }), 'https://oauth2.googleapis.com/token', 'URL alternativa só em loopback');
  limparCacheContaServico();
}

// ---------- ponta a ponta no Worker (handler real): administradora × monitora ----------
{
  const cs = await criarContaServicoDeTeste();
  const abas: Record<string, any[][]> = {
    turmas: dados.turmas, matriculas: dados.matriculas, alunos: dados.alunos, frequencias: dados.frequencias.map(l => [...l]),
    grupos_pratica: dados.grupos_pratica, grupo_integrantes: dados.grupo_integrantes,
    avaliacoes: [['avaliacao_id', 'matricula_id', 'nota'], ['v1', 'mA', 8]], ocorrencias: [['ocorrencia_id', 'matricula_id', 'descricao'], ['o1', 'mA', 'confidencial']],
    encontros_turma: [['encontro_id', 'turma_id', 'data', 'status', 'observacao'], ['e1', 't2b', '2026-10-13', 'PREVISTO', ''], ['e2', 't3b', '2026-10-13', 'PREVISTO', '']],
  };
  const amb = await criarAmbiente({ abas, env: {
    ADMIN_EMAILS: 'professora@exemplo.com',
    ACESSOS_JSON: JSON.stringify({ monitoras: [{ email: 'monitora@exemplo.com', turmas: ['t2b'], operacoes: ['CHAMADA'] }] }),
    GOOGLE_SERVICE_ACCOUNT_JSON: cs.json } });
  const chamar = async (email: string | null, caminho: string, metodo = 'GET', corpo?: unknown) => {
    const headers: Record<string, string> = { Authorization: 'Bearer token-google-do-usuario', 'Content-Type': 'application/json' };
    if (email) headers['X-Firebase-Id-Token'] = await amb.emissor.token(email);
    const r = await fetch(caminho, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined });
    return { status: r.status, corpo: await r.json() as any };
  };
  const escrever = (email: string, op: string, tabela: string, tipo: string, registro: any, esperado: any = null) =>
    chamar(email, '/api/critical-write', 'POST', { tabela, tipo, operacaoId: op, registro, esperado });
  const M = 'monitora@exemplo.com', A = 'professora@exemplo.com';

  // identidade
  assert.equal((await chamar(null, '/api/acesso')).status, 401);
  assert.equal((await chamar('aluna@exemplo.com', '/api/acesso')).status, 403, 'sem acesso estudantil');
  const ac = (await chamar(M, '/api/acesso')).corpo; assert.equal(ac.papel, 'MONITORA'); assert.deepEqual(ac.turmas, ['t2b']); assert.deepEqual(ac.operacoes, ['CHAMADA']);
  assert.deepEqual(ac.avisos, [], 'avisos de configuração só para a administradora');

  // monitora grava chamada da própria turma — com a CONTA DE SERVIÇO, nunca com o token Google dela
  const antes = amb.chamadas.length;
  let r = await escrever(M, 'mon-op-0001', 'frequencias', 'UPDATE', { frequencia_id: 'f1', matricula_id: 'mA', data_aula: '2026-10-13', status: 'FALTA_SEM_JUSTIFICATIVA' },
    { frequencia_id: 'f1', matricula_id: 'mA', data_aula: '2026-10-13', status: 'PRESENTE' });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  const usadas = amb.chamadas.slice(antes).filter(c => c.url.includes('/v4/spreadsheets')).map(c => c.auth);
  assert(usadas.length > 0 && usadas.every(a => a === 'Bearer token-conta-servico'), 'o Sheets só viu a conta de serviço: ' + usadas.join('|'));
  assert.equal(abas.frequencias[1][3], 'FALTA_SEM_JUSTIFICATIVA');
  assert.equal(abas.log_alteracoes.at(-1)![2], 'monitora@exemplo.com', 'log com a identidade da monitora');

  // fora da turma / tabela não delegada / exclusão / turma indeterminada
  r = await escrever(M, 'mon-op-0002', 'frequencias', 'UPDATE', { frequencia_id: 'f2', matricula_id: 'mC', data_aula: '2026-10-13', status: 'FALTA_SEM_JUSTIFICATIVA' }, { frequencia_id: 'f2', matricula_id: 'mC', data_aula: '2026-10-13', status: 'PRESENTE' });
  assert.equal(r.status, 403); assert.equal(r.corpo.code, 'FORA_DA_TURMA'); assert.equal(abas.frequencias[2][3], 'PRESENTE');
  r = await escrever(M, 'mon-op-0003', 'frequencias', 'UPDATE', { frequencia_id: 'f3', matricula_id: 'mB', data_aula: '2026-10-14', status: 'FALTA_SEM_JUSTIFICATIVA' }, { frequencia_id: 'f3', matricula_id: 'mB', data_aula: '2026-10-14', status: 'PRESENTE' });
  assert.equal(r.corpo.code, 'FORA_DA_TURMA', 'a matrícula 3B do mesmo aluno é de outra turma');
  r = await escrever(M, 'mon-op-0004', 'encontros_turma', 'UPDATE', { encontro_id: 'e2', turma_id: 't2b', status: 'REALIZADO' }, { encontro_id: 'e2', turma_id: 't3b', status: 'PREVISTO' });
  assert.equal(r.status, 403, 'não pode "mover" encontro de outra turma para a sua'); assert.equal(abas.encontros_turma[2][3], 'PREVISTO');
  r = await escrever(M, 'mon-op-0005', 'encontros_turma', 'UPDATE', { encontro_id: 'e1', turma_id: 't2b', status: 'REALIZADO' }, { encontro_id: 'e1', turma_id: 't2b', status: 'PREVISTO' });
  assert.equal(r.status, 200, 'encontro da própria turma');
  r = await escrever(M, 'mon-op-0006', 'avaliacoes', 'UPDATE', { avaliacao_id: 'v1', nota: 10 }, { avaliacao_id: 'v1', nota: 8 });
  assert.equal(r.status, 403); assert.equal(r.corpo.code, 'OPERACAO_NAO_DELEGADA'); assert.equal(abas.avaliacoes[1][2], 8, 'nota intacta');
  r = await escrever(M, 'mon-op-0007', 'ocorrencias', 'UPDATE', { ocorrencia_id: 'o1', descricao: 'x' }, { ocorrencia_id: 'o1', descricao: 'confidencial' });
  assert.equal(r.status, 403);
  r = await escrever(M, 'mon-op-0008', 'frequencias', 'DELETE', { frequencia_id: 'f1', matricula_id: 'mA', data_aula: '2026-10-13' }, { frequencia_id: 'f1', matricula_id: 'mA', data_aula: '2026-10-13', status: 'FALTA_SEM_JUSTIFICATIVA' });
  assert.equal(r.status, 403);
  r = await escrever(M, 'mon-op-0009', 'frequencias', 'INSERT', { frequencia_id: 'f9', data_aula: '2026-10-13', status: 'PRESENTE' });
  assert.equal(r.corpo.code, 'TURMA_INDETERMINADA', 'sem matrícula nem turma: negado');

  // leitura filtrada pelo servidor
  r = await chamar(M, '/api/leitura?tabelas=avaliacoes'); assert.equal(r.status, 403); assert.equal(r.corpo.code, 'TABELA_NAO_DELEGADA');
  r = await chamar(M, '/api/leitura?tabelas=turmas,matriculas,alunos,frequencias,encontros_turma'); assert.equal(r.status, 200, JSON.stringify(r.corpo).slice(0, 200));
  const t = r.corpo.tabelas;
  assert.deepEqual(t.turmas.values.slice(1).map((l: any[]) => l[0]), ['t2b']);
  assert.deepEqual(t.matriculas.values.slice(1).map((l: any[]) => l[0]), ['mA', 'mD']);
  assert(!t.alunos.values[0].includes('email')); assert(!JSON.stringify(r.corpo).includes('e1@x.com'), 'e-mail de aluno nunca sai');
  assert(!JSON.stringify(r.corpo).includes('atestado'), 'justificativa nunca sai');
  assert(!JSON.stringify(r.corpo).includes('confidencial'));
  assert.equal((await chamar(A, '/api/leitura?tabelas=avaliacoes,ocorrencias')).status, 200, 'administradora lê tudo');

  // administradora continua grava com o próprio token Google
  const a0 = amb.chamadas.length;
  r = await escrever(A, 'adm-op-0001', 'avaliacoes', 'UPDATE', { avaliacao_id: 'v1', nota: 9 }, { avaliacao_id: 'v1', nota: 8 });
  assert.equal(r.status, 200);
  assert(amb.chamadas.slice(a0).filter(c => c.url.includes('/v4/spreadsheets')).every(c => c.auth === 'Bearer token-google-do-usuario'), 'administradora usa o próprio acesso');

  // cliente: leitura via servidor monta o resultado do app e marca o que foi retido
  const { carregarViaServidor } = await import('../services/leituraServidor');
  const { limparCachePerfil, obterPerfilServidor } = await import('../services/escritaCoordenadaService');
  limparCachePerfil(); amb.entrar(M);
  const perfilM = await obterPerfilServidor(); assert.equal(perfilM?.papel, 'MONITORA');
  const lido = await carregarViaServidor(perfilM!);
  assert.deepEqual(lido.matriculas.map((m: any) => m.matricula_id), ['mA', 'mD']);
  assert(lido._restritas!.includes('avaliacoes') && lido._restritas!.includes('ocorrencias') && lido._restritas!.includes('entregas'), 'confidenciais ficam retidas');
  assert.equal(lido.avaliacoes!.length, 0); assert.equal(lido.ocorrencias!.length, 0);
  limparCachePerfil(); amb.entrar(A);

  // sem conta de serviço, monitora não grava nem lê (e a administradora segue)
  const amb2 = await criarAmbiente({ abas: { turmas: dados.turmas, matriculas: dados.matriculas, frequencias: dados.frequencias.map(l => [...l]), grupos_pratica: dados.grupos_pratica },
    env: { ACESSOS_JSON: JSON.stringify({ administradoras: [A], monitoras: [{ email: M, turmas: ['t2b'], operacoes: ['CHAMADA'] }] }) } });
  const h = async (email: string) => ({ 'X-Firebase-Id-Token': await amb2.emissor.token(email), Authorization: 'Bearer x', 'Content-Type': 'application/json' });
  const l2 = await fetch('/api/leitura?tabelas=turmas', { headers: await h(M) }); assert.equal(l2.status, 503); assert.equal((await l2.json() as any).code, 'CONTA_SERVICO_INDISPONIVEL');
  const w2 = await fetch('/api/critical-write', { method: 'POST', headers: await h(M), body: JSON.stringify({ tabela: 'frequencias', tipo: 'UPDATE', operacaoId: 'mon-sem-sa-1', registro: { frequencia_id: 'f1', matricula_id: 'mA', data_aula: '2026-10-13', status: 'X' }, esperado: {} }) });
  assert.equal(w2.status, 503);
  amb2.restaurar();
  amb.restaurar();
}
console.log('Perfis: PROFESSORA_ADMIN × MONITORA (escrita por turma/tabela, leitura filtrada, conta de serviço) validados.');
