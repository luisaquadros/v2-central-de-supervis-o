# Autenticação, publicação e resolução de problemas

## Diagnóstico conhecido (13/10/2026)

Foi observado no iPhone o erro do domínio de autenticação Firebase: `Unable to process request due to missing initial state`. A mensagem indica que o estado temporário de uma operação OAuth não estava disponível na etapa de retorno. **Ela não prova que os dados do Sheets foram perdidos.**

O código auditado utiliza `signInWithPopup` do Firebase, `browserLocalPersistence`, `authDomain` do projeto Firebase e guarda temporariamente o token OAuth para Sheets em `sessionStorage`. Não mudar mecanicamente para `signInWithRedirect`: em navegadores com armazenamento particionado e domínios diferentes, o redirecionamento também pode falhar. Necessário testar configuração no domínio real.

## Checklist para quem mantém o aplicativo

1. Confirmar o URL HTTPS exato do aplicativo utilizado com sucesso no Safari. Não confundir a URL do app com `*.firebaseapp.com`, que pode ser apenas o domínio auxiliar do OAuth.
2. No Firebase Console do projeto indicado no arquivo `firebase-applet-config.json`, conferir **Authentication → Settings → Authorized domains**. Confirmar o domínio real de publicação.
3. Confirmar provedor **Google** habilitado no Firebase Authentication; revisar **Google Cloud Console → APIs & Services → Credentials / OAuth consent screen**, origens JS e URIs de redirecionamento apropriadas à configuração efetiva. Não divulgar segredos OAuth.
4. Para produção em domínio próprio / Cloudflare, consultar a orientação vigente do Firebase para provedores OAuth e navegadores que bloqueiam armazenamento de terceiros. Pode ser necessário configurar domínio de autenticação compatível, e não simplesmente trocar `authDomain` sem configurar hospedagem/proxy.
5. Testar início e retorno do login no Safari iOS, sessão nova, atalho instalado, Chrome/desktop, expiração do token e erros de acesso ao Sheets.
6. Após autenticação, testar leitura da planilha e registro de uma alteração de teste autorizada; verificar status de sincronização. Se falhar, não marcar dados como sincronizados.
7. Registrar aqui os resultados, URL de produção, commit e procedimento de deploy confirmados.

## Para a usuária

- Usar a versão web já funcional até validar o atalho.
- Se aparecer erro de estado inicial, fechar a aba de erro, voltar ao endereço original do aplicativo e reiniciar o login uma única vez.
- Não apagar dados/cache do atalho até conferir registros locais pendentes.
- Para identificar o endereço correto no Safari: toque na barra de endereços e copie a URL do aplicativo **antes** de entrar com Google. Não copiar a página intermediária de erro `firebaseapp.com`.

## Cuidados de segurança

- Nunca enviar screenshots contendo prontuários, tokens ou parâmetros `code`/`state` de OAuth.
- Não remover a validação de acesso à planilha e não persistir credenciais de modo permanente para mascarar a falha.
- Separar erros de autenticação de erros de sincronização, com retorno visível e tempo limite.
- Fazer backup e verificar a fila de operações locais antes de qualquer limpeza de armazenamento.

## Configuração observada no repositório

- `src/services/googleSheetsService.ts`: Firebase Auth e OAuth Sheets.
- `src/context/SupervisaoContext.tsx`: integração de login, validação e sincronização.
- `src/views/PrimeiraConexaoView.tsx`: interface de login e erros.
- `src/services/sessionPolicy.ts`: sessão verificada local, diferente do token OAuth.
- `wrangler.jsonc`: configuração de build/assets Cloudflare.

**Não documentado/confirmado até esta revisão:** domínio HTTPS da publicação utilizada, ambiente Firebase efetivamente autorizado e configuração operacional final de deploy.


## Evolução de outubro/2026 — login único e homologação para produção

### Modelo de acesso adotado (transição segura)

- **Login do aplicativo:** Firebase Authentication com a conta Google autorizada; sessão persistente no próprio dispositivo, sujeita a encerramento explícito e validação no Worker.
- **Leitura da planilha:** `/api/leitura` usa a conta de serviço no Cloudflare; no modo `viaContaServico`, a professora passa a ler por essa rota como as monitoras.
- **Escritas críticas:** `/api/critical-write` continua exigindo token de identidade Firebase verificado, perfil autorizado, tabela/turma válida, comparação de versão, idempotência e log. Com `GOOGLE_SERVICE_ACCOUNT_JSON`, o Worker também autentica a **professora** na API do Sheets, sem exigir OAuth de planilha no dispositivo.
- **Estrutura de avaliação:** com conta de serviço, a rota de estrutura pode executar sem bearer OAuth do Sheets, preservando confirmação e checksum de backup.
- **Modo legado:** sem conta de serviço, a administradora ainda depende de token OAuth do Sheets; a monitora falha fechada.
- **Não desligar ainda o escopo Google Sheets no frontend**: há gravações administrativas que ainda usam o caminho direto para `registros_semanais`, `criterios_avaliacao`, `configuracoes` e `marcos_academicos`. Com o token expirado elas permanecem pendentes no dispositivo, e não podem ser anunciadas como gravadas remotamente. Migrar uma a uma com testes antes de remover o escopo.

### Estado real da produção verificado em 16/10/2026

- Cloudflare `v2-central-de-supervis-o`: deployment publicado mais recente em **13/10/2026**, anterior à versão do PR.
- Bindings encontrados: `ASSETS`, `WRITE_COORDINATOR`; **não foram confirmados** `ADMIN_EMAILS`, `ACESSOS_JSON` nem `GOOGLE_SERVICE_ACCOUNT_JSON`.
- Cron Triggers: **nenhum ativo**. Não ativar a sincronização automática antes de testar conta de serviço, planilha, logs e backups.
- A base usada pelo código ainda se chama **Central de Supervisão - DESENVOLVIMENTO**. A base de produção e o compartilhamento correto com a conta de serviço precisam ser definidos e verificados antes do lançamento.
- Builds e testes do PR validam o código, mas não substituem testes de autenticação, permissões, gravação, conflito e persistência no ambiente Google real.

### Portão de liberação (todos os requisitos obrigatórios)

- [ ] Confirmar planilha-alvo de produção e backup íntegro, sem alterar a base do semestre durante o ensaio.
- [ ] Configurar `ADMIN_EMAILS` e `ACESSOS_JSON` no Worker, sem credenciais no repositório.
- [ ] Criar conta de serviço no Google Cloud, conceder-lhe apenas as permissões necessárias na planilha-alvo e configurar `GOOGLE_SERVICE_ACCOUNT_JSON` como segredo do Worker. Nunca enviar JSON da chave em chats ou Git.
- [ ] Validar domínio HTTPS autorizado no Firebase, Safari iPhone, Android e desktop, sessão persistida e troca de conta.
- [ ] Executar login com professora e monitora; negar acesso fora da turma, notas e registros confidenciais à monitora.
- [ ] Em uma **cópia** da planilha, gravar/reler chamada, documentos, RSS e notas autorizadas; conferir versões, log, conflitos entre dispositivos, fila offline e restauração de backup.
- [ ] Migrar as quatro tabelas ainda em acesso direto ao Sheets, com testes e sem destruir fórmulas ou cabeçalhos; só então retirar o OAuth da planilha do fluxo habitual.
- [ ] Conferir dependências do Apps Script atualmente implantado antes de mesclar o PR, pois o diretório `gas/` foi removido.
- [ ] Validar no Worker publicado após deployment, conferir rollback e somente então liberar escrita na base definitiva.

**Status: PR em homologação, NÃO pronto para publicação irrestrita.** Essas dependências não podem ser supridas por um build verde; não assumir que o app está operacional com dados reais.
