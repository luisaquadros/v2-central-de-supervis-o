# Estado de execução

Atualizado: 14/10/2026 · Branch `fix/backend-persistencia-integridade` (PR #46)

**Objetivo atual:** avaliação formativa (D3) integrada à estrutura existente, preservando notas oficiais; preparar a validação real em cópia da planilha.

## Concluído (detalhes em `DOCUMENTO_MESTRE.md` §6)
E1 · E2 (perfis, servidor) · 23 tabelas coordenadas · documentos do Drive + sincronização · horário alternativo · **E3-D1** (chamada NAO_REGISTRADO + prévia + confirmação) · cache limpo na troca de usuária · `test:worker-real` no CI.

## Testes (último ciclo)
lint ✔ · `npm test` (32 arquivos) ✔ · build ✔ · `test:worker-real` ✔ · navegador (simulado): prévia sem gravação prévia, clique duplo sem duplicar. Tudo **simulado**: nada validado com planilha/Google/Drive/Firebase reais.

## Depende da usuária
- Validação real em cópia da planilha (`ADMIN_EMAILS`, conta de serviço, `ACESSOS_JSON`; Configurações → Conferência: aba `monitoramento_documentos` e vínculos do Olyver).
- Conferir Apps Script antes de mesclar (PR remove `gas/`).
- D2, D3, D5, D6, D7. Ativar sincronização/crons só após a validação real.

## Próxima ação exata
1. **Precisa de autorização**: retificação de chamada encerrada (altera frequência já confirmada, ainda que com trilha).
2. ✔ Abas confidenciais da ficha ocultas para monitora (implementado; não exercitado no navegador com perfil monitora).
3. (Bloqueado por D2/D3/validação real) regras de falta/atraso, rubricas, ativação de crons.

## Avaliação formativa (D3 aplicada) — estado
- **Implementado (simulado/local):** engine oficial×prévia×prazo×divergência; cálculo unificado entre `AvaliacaoView` e `AlunoFichaView` (`avaliacaoResumo.ts`); nota inválida sinalizada (nunca 0); rubrica de Documentação versionada com níveis e descritores por estágio; estrutura aditiva de 4 abas (coordenador, log sem texto livre); `/api/estrutura/avaliacao` (diagnóstico + criação aditiva, desligada por padrão); evidências; contribuição preliminar de monitora (servidor); avaliação parcial/final; devolutiva determinística; painel "Estrutura da avaliação" em Configurações. Detalhes: `DOCUMENTO_MESTRE.md` §4.1–4.5, §5, §8.1.
- **Nada alterado:** notas oficiais, critérios, abas existentes, planilha real. Abas novas **ainda não criadas** em nenhuma planilha.
- **Testes:** lint · `npm test` (43 arquivos) · build · `test:worker-real` (novo cenário da estrutura) · navegador desktop e celular (dados anonimizados) — ver commit final.
- **Auditoria da estrutura real:** 6 turmas × 8 critérios = 10,0; nomes variam, `codigo_criterio` estável.

## RSS simplificado (decisão de 14/10) — implementado
- **Regra:** dois status (ENTREGUE / NÃO ENTREGUE), identificação automática por unidade+turma+semana (semana_rss ou data no cronograma), sem validação individual, sem desconto. Detalhes em `DOCUMENTO_MESTRE.md` §4.6.
- **Preservado:** `registros_semanais` nunca é alterada; 0 entregas perdidas na verificação com a planilha anonimizada (86 matrículas); correções de associação e observações em `rss_ajustes` (aditiva, auditável, reversível).
- **Monitora:** vê o status administrativo (lista branca de colunas, delegação `ENTREGAS`); nunca o conteúdo clínico. `CLAUDE.md` atualizado nesse ponto.
- **Testes:** `testRssEntregas`, `testRssMonitora`, testes de RSS existentes ajustados à nova regra (registro "em revisão" agora conta como entrega), `test:worker-real` (5 abas), navegador desktop e celular (administradora) e desktop (monitora).
- **Pendente (você):** criar a aba `rss_ajustes` junto com as demais (painel "Estrutura da avaliação e correções de RSS", §8.1) numa cópia da planilha; confirmar que "atraso" = entrega depois do fim da semana do cronograma (hoje só informativo).

## Depende da professora
1. **Registros semanais × Seminário/Atividade (0,5):** a ficha tem "Registros semanais 0,5"; a planilha tem "Seminário/Atividade avaliativa 0,5". Qual vale? (nenhum critério novo foi criado.)
2. Os valores 1,25 / 0,40 / 0,50 / 0,10 da ficha são provisórios (50% do peso)? O app só considera notas lançadas em `avaliacoes`.
3. Aprovar (ou ajustar) os descritores da rubrica de Documentação e fornecer os da **Consultoria Organizacional**.
4. Pesos internos de Participação e Desempenho (rubricas ficam manuais até lá).
5. Regras expressas de desconto por atraso (por turma) — hoje nenhum desconto automático existe.
6. Criar as 4 abas numa **cópia** da planilha (§8.1 do documento mestre) e validar com os dados reais; só depois na planilha oficial.
7. Registro estruturado de participação em sala (hoje ausente: o rascunho diz "não constam registros").
8. Retificação de chamada (altera frequência confirmada), D2, D5–D7, validação real de Google/Firebase/Cloudflare e conferência do Apps Script (carregados de antes).

## Próxima ação exata
Validar numa cópia da planilha: criar as 4 abas pelo painel, configurar a rubrica de uma turma, preencher uma avaliação e conferir log, versões e permissões da monitora com a conta de serviço real.


## Auditoria complementar — 16/10/2026 (PR #46)

### Correções efetuadas nesta rodada
- Removidos 24 bancos SQLite temporários da árvore Git e bloqueado seu reenvio pelo CI; revisar histórico Git separadamente caso contenha dados indevidos.
- Leitura acadêmica agora exige perfil confirmado pelo Worker, sem fallback para leitura direta quando a autorização não responde.
- Troca de usuário verifica a posse do cache e a identidade da fila antes de reutilizar dados; telas administrativas deixam de ser exibidas sem perfil confirmado.
- Navegação mobile ajustada por perfil, menu lateral rolável, indicação do item atual e retorno à tela inicial na troca de conta.
- Sincronização: conflitos aparecem prioritariamente no indicador e no painel, diferenciados de alterações apenas pendentes.
- Leitura de monitoras usa colunas permitidas em alunos e monitoramento de documentos; testes verificam novas colunas e identificadores internos.
- A rotina de CI passou a exigir `npm run test:worker-real` (workerd com Google/Drive/Sheets simulados), além de lint, testes e build.

### Conferências externas (somente leitura)
- Planilha **Central de Supervisão - DESENVOLVIMENTO**: as abas de avaliação e ajustes previstas no PR ainda não estão presentes; `monitoramento_documentos` tem 17 colunas, incluindo `observacao_administrativa`.
- Cloudflare Worker publicado: último deployment de produção verificado datado de 13/10/2026. Na consulta de bindings apareceram `ASSETS` e `WRITE_COORDINATOR`; não foram confirmadas as variáveis/credenciais necessárias para ativar a nova autorização. Não havia Cron Triggers cadastrados.
- Os builds de prévia do PR **não** comprovam que a versão de produção esteja atualizada ou autenticando/gravoando na planilha real.

### Critérios ainda bloqueantes antes de mesclar/publicar
1. Verificar o Apps Script ativo e suas integrações antes de aceitar a remoção de `gas/`.
2. Configurar e testar `ADMIN_EMAILS`, `ACESSOS_JSON`, conta de serviço e permissões do Google sem inserir segredos no Git.
3. Homologar login, leitura, escrita, recarga e troca de dispositivo numa cópia da planilha, com perfis professora e monitora.
4. Validar backup e criar as abas aditivas da avaliação/RSS **somente** na cópia; confirmar critérios acadêmicos sem mudar notas oficiais.
5. Resolver as decisões institucionais D2, D3, D5–D7 antes de ativar automações e regras que afetem avaliação/frequência.

**Status:** alterações no PR, sem merge. Não autorizado declarar uso exclusivo em produção até a homologação real.
