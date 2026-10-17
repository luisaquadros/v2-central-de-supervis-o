# Central de Supervisão Acadêmica

Aplicação de apoio à supervisão dos estágios de Psicologia, com gestão de turmas, estudantes, frequência, avaliações, orientações, documentos, RSS e pendências.

> **Atenção:** este repositório contém código de uma ferramenta acadêmica com informações potencialmente sigilosas. Nunca incluir dados clínicos identificáveis, chaves privadas, tokens de sessão ou cópias da planilha oficial em commits, issues ou capturas de tela.

## Para começar

1. Abra o **endereço de publicação oficial** informado pela responsável pelo projeto (a URL de produção ainda precisa ser registrada aqui após confirmação).
2. Entre com a conta Google que tenha permissão de acesso à planilha acadêmica oficial.
3. Aguarde a autenticação e a validação da leitura dos dados. Confira os indicadores de conexão e sincronização antes de registrar informações.
4. No iPhone, primeiro confirme o login diretamente no Safari. Só então instale o atalho da tela inicial por **Compartilhar → Adicionar à Tela de Início**. Não instale atalhos apontando para endereços temporários, prévias do AI Studio ou o domínio intermediário do Firebase.

**Se o login falhar:** não apague os dados do navegador ou do aplicativo antes de confirmar que não há alterações locais pendentes de sincronização. Consulte [Diagnóstico de autenticação](docs/AUTENTICACAO_E_PUBLICACAO.md).

## Funcionalidades

- **Hoje:** prioridades e contexto da supervisão atual.
- **Turmas / Alunos:** estrutura acadêmica e ficha contextual.
- **Modo Supervisão (Modo Aula):** chamada por exceção, lista e ficha de estudante, RSS, orientações, feedback e ações de acompanhamento. A implementação ativa está em `src/views/ModoSupervisaoView.tsx`. O arquivo `ModoAulaView.tsx` existe, mas não é o fluxo usado na navegação principal; evitar duplicar funcionalidades entre ambos.
- **Frequência, Avaliação, Calendário, Pendências:** consultas e registros relacionados.
- **Administração:** semestres, configurações e estados de conexão.

## Fonte de dados e proteção

- **Google Sheets:** base acadêmica oficial; configuração de tabelas em `src/services/googleSheetsService.ts`.
- **IndexedDB:** cache de trabalho local; conferir sincronização remota antes de confiar em alterações recentes.
- **Autenticação:** Firebase Authentication + Google OAuth com escopo Google Sheets. O login Firebase e o token OAuth do Sheets são distintos. A aplicação só libera dados acadêmicos após validação autorizada, respeitando a política de sessão.
- Não contornar o login, retirar a verificação de acesso, limpar cache automaticamente ou registrar informações clínicas identificáveis.

## Desenvolvimento local

Requer Node compatível com o fluxo CI (atualmente Node 24).

```bash
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Atenção: o build local não comprova OAuth funcional no domínio publicado, nem autoriza uso de dados reais em ambientes de teste.

## Publicação

O repositório tem configuração para **Cloudflare Workers** em `wrangler.jsonc`, mas a existência do arquivo não comprova um deploy ativo. Identifique a URL realmente utilizada, verifique os domínios autorizados no Firebase Authentication e valide o retorno do Google OAuth em navegador, iPhone e atalho. [Procedimento completo](docs/AUTENTICACAO_E_PUBLICACAO.md).

## Manutenção e identidade visual

A identidade e seus tokens estão documentados em [docs/IDENTIDADE_VISUAL.md](docs/IDENTIDADE_VISUAL.md) e `src/styles/brandTokens.ts`. Manter consistência visual, responsividade e acessibilidade, sem alterar modelos, regras acadêmicas ou segurança por razões estéticas.

Antes de cada alteração: verificar versão, criar branch, testar `lint`/`test`/`build`, validar fluxo crítico com a base autorizada e registrar possíveis etapas manuais de publicação.

## Pendências de configuração

- [ ] Registrar URL oficial e confirmar que é o endereço usado no Safari e no atalho.
- [ ] Conferir domínios autorizados no Firebase e configuração de autenticação no provedor Google.
- [ ] Testar login completo no iPhone (Safari e atalho/PWA).
- [ ] Conferir que o deploy publicado corresponde ao commit esperado.
- [ ] Verificar sincronização de leitura e escrita antes do uso operacional.

