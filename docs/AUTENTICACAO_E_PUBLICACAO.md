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
