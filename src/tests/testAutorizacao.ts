import assert from 'node:assert/strict';
import worker, { WriteCoordinator } from '../server/worker';
import { verificarIdTokenFirebase, autorizarAdministrador, limparCacheJwks, listaDeAdministradores, urlJwks, URL_JWKS_PADRAO } from '../server/autorizacao';
import { criarEmissor, ehJwks } from './ajudaAutorizacao';

const emissor = await criarEmissor(), outro = await criarEmissor('chave-teste-1'); // mesma kid, chave diferente
const velho = globalThis.fetch;
let chamadasJwks = 0;
const ok = (d: unknown) => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = (async (input: any, init?: RequestInit) => {
  const url = String(input);
  if (ehJwks(url)) { chamadasJwks++; return ok(emissor.jwks); }
  return (velho as any)(input, init);
}) as typeof fetch;
const ENV = { ADMIN_EMAILS: 'Professora@Exemplo.com' };
const agora = Date.now();
try {
  // --- verificação do token ---
  limparCacheJwks();
  const bom = await emissor.token('professora@exemplo.com');
  assert.equal((await verificarIdTokenFirebase(bom, ENV)).email, 'professora@exemplo.com');
  await verificarIdTokenFirebase(bom, ENV); assert.equal(chamadasJwks, 1, 'chaves públicas ficam em cache');
  const rejeita = async (t: string, rotulo: string) => assert.rejects(() => verificarIdTokenFirebase(t, ENV), Error, rotulo);
  await rejeita(await emissor.token('a@b.com', { exp: Math.floor(agora / 1000) - 5 }), 'expirado');
  await rejeita(await emissor.token('a@b.com', { aud: 'outro-projeto' }), 'público errado');
  await rejeita(await emissor.token('a@b.com', { iss: 'https://securetoken.google.com/outro' }), 'emissor errado');
  await rejeita(await emissor.token('a@b.com', { email_verified: false }), 'e-mail não verificado');
  await rejeita(await emissor.token('a@b.com', { iat: Math.floor(agora / 1000) + 9999 }), 'emitido no futuro');
  await rejeita(await outro.token('professora@exemplo.com'), 'assinatura de outra chave');
  await rejeita(await emissor.token('a@b.com', {}, agora, { kid: 'desconhecida' }), 'kid desconhecida');
  await rejeita(await emissor.token('a@b.com', {}, agora, { alg: 'none' }), 'algoritmo none');
  const [h, c, s] = bom.split('.');
  const falso = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(c, 'base64url').toString()), email: 'invasor@x.com' })).toString('base64url');
  await rejeita(`${h}.${falso}.${s}`, 'payload adulterado');
  await rejeita('lixo', 'formato');

  // --- rotação de chaves: kid novo busca de novo, mas no máximo 1x por minuto ---
  limparCacheJwks(); chamadasJwks = 0;
  await verificarIdTokenFirebase(bom, ENV, agora);                       // 1ª busca
  const novoEmissor = await criarEmissor('chave-nova-2');
  const velhoEmissor = emissor.jwks;
  (emissor as any).jwks = { keys: [...velhoEmissor.keys, ...novoEmissor.jwks.keys] };
  const tokenNovo = await novoEmissor.token('professora@exemplo.com', {}, agora + 90_000);
  await assert.rejects(() => verificarIdTokenFirebase(tokenNovo, ENV, agora + 10_000), Error, 'kid novo dentro de 1 min não rebusca');
  assert.equal(chamadasJwks, 1);
  assert.equal((await verificarIdTokenFirebase(tokenNovo, ENV, agora + 90_000)).email, 'professora@exemplo.com', 'após 1 min rebusca e aceita a chave rotacionada');
  assert.equal(chamadasJwks, 2);
  (emissor as any).jwks = velhoEmissor; limparCacheJwks();

  // --- autorização ---
  assert.deepEqual(listaDeAdministradores({ ADMIN_EMAILS: ' A@x.com, b@y.com; lixo ' }), ['a@x.com', 'b@y.com']);
  let r = await autorizarAdministrador(bom, {}); assert.equal(r.ok, false); assert.equal((r as any).status, 503, 'sem lista configurada: falha fechada');
  r = await autorizarAdministrador(null, ENV); assert.equal((r as any).status, 401);
  r = await autorizarAdministrador('lixo', ENV); assert.equal((r as any).status, 401);
  r = await autorizarAdministrador(await emissor.token('aluna@exemplo.com'), ENV); assert.equal((r as any).status, 403, 'conta válida fora da lista');
  r = await autorizarAdministrador(bom, ENV); assert.equal(r.ok, true); assert.equal((r as any).email, 'professora@exemplo.com', 'ignora maiúsculas');
  assert.equal(urlJwks({ JWKS_URL: 'https://evil.example/jwks' }), URL_JWKS_PADRAO, 'URL de teste só vale em loopback');
  assert.equal(urlJwks({ JWKS_URL: 'http://127.0.0.1:9/jwks' }), 'http://127.0.0.1:9/jwks');

  // --- handler do Worker ---
  const repassados: { usuario: string | null; corpo: string }[] = [];
  const envW: any = { ...ENV, ASSETS: { fetch: async () => new Response('asset') },
    WRITE_COORDINATOR: { idFromName: () => 'x', get: () => ({ fetch: async (rq: Request) => { repassados.push({ usuario: rq.headers.get('X-Usuario-Verificado'), corpo: await rq.text() }); return ok({ ok: true }); } }) } };
  const post = (headers: Record<string, string>, corpo = '{"tabela":"x"}') => worker.fetch(new Request('https://app.exemplo/api/critical-write', { method: 'POST', headers, body: corpo }), envW);
  assert.equal((await post({})).status, 401, 'sem token de identidade');
  assert.equal((await post({ 'X-Firebase-Id-Token': await emissor.token('aluna@exemplo.com') })).status, 403);
  assert.equal(repassados.length, 0, 'recusadas não chegam ao coordenador');
  const corpoFalso = JSON.stringify({ tabela: 'x', usuario: 'outra@pessoa.com' });
  assert.equal((await post({ 'X-Firebase-Id-Token': bom }, corpoFalso)).status, 200);
  assert.equal(repassados[0].usuario, 'professora@exemplo.com', 'identidade vem do token, não do corpo');
  assert.equal((await worker.fetch(new Request('https://app.exemplo/api/critical-write', { method: 'POST', headers: { 'X-Firebase-Id-Token': bom }, body: '{}' }), { ...envW, ADMIN_EMAILS: '' })).status, 503);
  const ac = await worker.fetch(new Request('https://app.exemplo/api/acesso', { headers: { 'X-Firebase-Id-Token': bom } }), envW);
  const acj = await ac.json() as any;
  assert.equal(acj.ok, true); assert.equal(acj.email, 'professora@exemplo.com'); assert.equal(acj.papel, 'PROFESSORA_ADMIN'); assert.deepEqual(acj.turmas, ['*']);
  assert.equal((await worker.fetch(new Request('https://app.exemplo/api/acesso'), envW)).status, 401);
  assert.equal((await worker.fetch(new Request('https://app.exemplo/index.html'), envW)).status, 200, 'arquivos estáticos não exigem login');
  assert.equal((await worker.fetch(new Request('https://app.exemplo/api/critical-write', { method: 'POST', headers: { 'X-Firebase-Id-Token': bom, Origin: 'https://evil.example' }, body: '{}' }), envW)).status, 403, 'origem estranha');

  // --- coordenador exige identidade verificada (defesa em profundidade) ---
  const srv = new WriteCoordinator({ storage: { get: async () => undefined, put: async () => {} } } as any, {} as any);
  const direto = await srv.fetch(new Request('https://i/w', { method: 'POST', headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' }, body: '{}' }));
  assert.equal(direto.status, 401);
  console.log('Autorização: token verificado no servidor, falha fechada, lista de administradores e identidade fora do corpo validados.');
} finally { globalThis.fetch = velho; }

// O Cloudflare só inicia o Worker se o módulo de entrada exportar apenas o handler e classes de Durable Object.
// (Um `export const` extra derrubou o runtime real em teste local; o CI com --dry-run não detecta isso.)
{
  const W = await import('../server/worker');
  assert.deepEqual(Object.keys(W).sort(), ['WriteCoordinator', 'default'], 'worker.ts não pode exportar auxiliares');
}
