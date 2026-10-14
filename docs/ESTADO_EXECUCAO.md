## Correção do aviso de cronograma — 14/10/2026

Branch `fix/alerta-cronograma-rss`, commit de implementação `13b646c`, sobre `bad5435`. Aviso da tela inicial do PR #46 rastreado até `calcularMetricasCronogramaRss`: comparava número da aula presencial com semana de prática. São contagens independentes. Comparação removida; sem calendário, não se infere semana nem se reduz RSS esperado pelo número da aula. Cronograma sem datas e contagens RSS inválidas/superiores ao total continuam sinalizados. Nenhum dado real lido ou modificado nesta correção; não foi confirmada a condição de uma turma real específica.
Validação: teste direcionado (68 verificações), 48 programas da suíte completa, TypeScript e build aprovados. Regressões incluem ciclos distintos, fim de prática com todas as semanas encerradas, fallback sem calendário e alertas genuínos. Não tocou Worker. Código corrigido; versão publicada ainda não alterada. Próxima ação: revisar/integrar a correção na referência publicada somente com autorização; não houve merge ou deploy.

# Checkpoint — semestres, confiabilidade e homologação

Atualizado: 14/10/2026. Branch própria `feat/semestres-confiabilidade-homologacao`, base integrada de desenvolvimento `be3e1d3`. Últimos commits de implementação: `c47fa24` e `43794f7`. Referências remotas conferidas nesta execução: main `d707105`; PR #46 `a3d6cba`, preservados. Nenhum merge em main, deploy, ativação de cron ou escrita em serviços oficiais.

## Implementado e testado localmente
- Herança restrita à estrutura: turmas, critérios, horários, configurações/rubricas aprovadas vinculadas aos critérios e marcos administrativos. IDs próprios; rubricas/configurações entram como rascunho, critérios A_CONFERIR; datas antigas e observações de alunos não são copiadas. Disciplinas continuam no catálogo canônico. Modelos ausentes/inconsistentes interrompem o planejamento antes dos envios.
- Criação com checkpoint persistido no IndexedDB existente antes dos efeitos. Para no primeiro envio pendente; retomada usa os mesmos IDs, aguarda a fila e confronta snapshot remoto autenticado. Resposta perdida não implica nova escrita; divergência/IDs duplicados/modelo adulterado bloqueiam retomada. Checkpoints separados por conta. Não é transação atômica nem sincronização offline completa.
- Novo semestre planejado/ativo, início das aulas e painel de retomada. Rubricas herdadas só são aprovadas após conferência explícita e confirmação remota; nenhuma versão anterior é alterada.
- Importação reconhece categorias administrativas sem criar enums/regras acadêmicas paralelas. Lançamento de notas permanece DOCENTE. Marco modelo sem data não é duplicado; edição explícita da data mantém ID/vínculos, prévia e controle de versão.
- Aprovação de inscrição e arquivamento não concluem visualmente enquanto o envio é apenas local. Encerramento recusa notas inválidas/fora do máximo e critérios A_CONFERIR; zero continua válido. Pendências consultadas pelo período alvo, mesmo com outro semestre selecionado.
- Checksum de backup estável após exportar/reabrir JSON contendo campos opcionais indefinidos; corrupção continua detectada.

## Evidências
- `npm test`: 48 programas aprovados, incluindo novo `testRetomadaPeriodo.ts`. Cenário fictício 2027.1: 3 turmas, 54 matrículas/51 alunos, seis semanas, 318 frequências, 18 encontros; vínculos/histórico, duplicidades, zero, replay e arquivamento técnico testados.
- TypeScript (`npm run lint`, sem ESLint separado), build e auditoria completa de dependências: aprovados, zero vulnerabilidades reportadas.
- `test:worker-real`: workerd local efetivo; Google, Drive, Firebase/JWKS e dados são simulados. Autorização, concorrência, replay, conflitos, falhas, metadados/cron manual e backup/restauração de registros exercitados sem produção.
- `test:ui`: seis fluxos, nove telas claro/escuro e 48 verificações de avaliações/monitoras a 320/390/768/1280 px; lista longa até 1440 px. Nova criação e edição de data confirmadas no navegador; zero violações axe nos cenários. `test:painel-configuracoes`: 390/1280 px, sucesso e falha após atualização preservados.
- Bindings gerados/conferidos em `/tmp/sem-worker-env.d.ts`; arquivo padrão não existe na base, por isso a primeira checagem padrão foi substituída pela geração isolada. Dry-run local aprovado, não é deploy. Artefatos de navegador em `artifacts/` ignorados pelo Git; logs locais `/tmp/sem-*`.

## Classificação e limites
**PARCIALMENTE CONCLUÍDO; NÃO APTO para homologação integral do semestre.**
P0: nenhum defeito aberto reproduzido no escopo exercitado; isso não demonstra ausência de risco em integrações reais.
P1: ciclo institucional completo de reposições, competências/participação estruturadas e retificação formal ainda não implementados/homologados. Proteções bloqueiam alterações comuns em chamadas encerradas e períodos arquivados. Não inventar a regra D2 nem substituir esse fluxo por edição direta. Homologação institucional ponta a ponta não foi simulada como sucesso.
P2: inscrição via Google Forms + QR + CSV conferido; abrir/fechar o formulário é manual no Forms, sem coleta automática. Correção/vinculação após inscrição importada não tem fluxo próprio; vínculos de matrícula permanecem imutáveis. Cópia de modelos de atividade/regras administrativas genéricas depende de classificação segura dos dados existentes, e não foi presumida. Edição de cronograma cobre datas; outros campos seguem a importação/configuração existentes.
P2 operacional: restauração efetiva validada apenas na base simulada; frequência/retensão institucional e armazenamento externo de backup não definidos nem ativados. Diagnóstico existente não comprova todos os acessos Google nem apresenta todos os indicadores solicitados. Recuperação portátil dos checkpoints operacionais não foi homologada. Cópia completa das rubricas foi testada em unidade; aprovação sequencial/retomada desse modelo precisa de integração isolada real.
P3: dispositivos físicos/leitor de tela e avaliação manual de usabilidade pendentes; axe não substitui essas verificações.
Fontes externas: documentação mestre e metadados/rubricas de desenvolvimento reaproveitados das leituras anteriores; nenhuma linha clínica/pessoal foi utilizada. Consulta adicional à documentação pública Cloudflare indisponível nesta execução; APIs existentes/tipos instalados e runtime local foram usados. Integração externa real e produção não validadas.

## Próxima ação exata
Resolver as lacunas P1 conforme decisões acadêmicas pendentes, sem criar regras paralelas. Para a etapa que depende da professora: disponibilizar/autorizar cópia isolada da planilha e pastas, contas docentes/monitora de teste e confirmar decisões institucionais de reposições, retificação e backup. Executar então leitura/escrita/reconexão/restauração nessa cópia; não usar dados oficiais. Branch disponível para revisão, sem merge automático ou PR criado.

---

# Estado de execução — redesign PRISMA

Atualizado: 14/10/2026. Branch própria `feat/prisma-integracao-avaliacoes-rss`.
Referências preservadas: main `d707105`; PR #46 `a3d6cba`; entrega Codex `c318913`; painel administrativo `fede73d`. Combinação realizada somente na branch de desenvolvimento, sem merge em main nem deploy.

## Etapas
0. Auditoria direcionada: reutilizada; documento mestre do Drive relido e referências verificadas.
1. Design system: PRISMA, tokens semânticos, Inter/Fraunces, Lucide, foco e alvos de toque; componentes novos seguem a identidade.
2. Navegação: Hoje, Agenda, Turmas, Avaliações e Acervo; barra mobile; acessos administrativos/contextuais e compatibilidade preservados.
3. Telas principais: Hoje acionável; quatro áreas de turma; ficha contextual por matrícula; linha do tempo inclui evidências/pareceres; Modo Aula mantém prévia/confirmar e não inventa presença.
4. Avaliação/monitoras: integrado o desenvolvimento recente do PR #46 (rubricas versionadas, evidências, contribuições preliminares, devolutiva e RSS simplificado). Pareceres acessíveis em Hoje/ficha; notas oficiais em seção expansível; chamada/notas continuam bloqueadas para monitoras no servidor. Nenhuma permissão real configurada.
5. Validação concluída em ambiente isolado: 47 programas, TypeScript, build, auditoria (zero alertas), bindings, dry-run, Worker local, nove telas/6 fluxos gerais, 48 verificações adicionais de avaliação/monitoras e painel administrativo. API Google/Firebase/Drive simulada.

## Correções específicas da integração
- Preservação das proteções de concorrência, fila, chamada, períodos e histórico anteriores.
- Fixtures novas com referências acadêmicas fictícias completas; testes não tiveram permissões ou integridade enfraquecidas.
- Estado das abas novas também limpo na troca de conta.
- Formulário da monitora conserva texto quando envio fica pendente; informa o estado real, evita duplo clique/reenvio enquanto pendente.
- Rubricas/avaliação com navegação por teclado, tabela legível no mobile, valores oficiais sem arredondamento visual indevido e contraste no tema escuro.
- Painel de Configurações preserva resultado da criação e eventual falha posterior; nenhuma aba real criada.
- Rascunho coletivo preserva o identificador virtual existente, com conferência do grupo/turma/critério no servidor; rascunho de grupo de outra turma recusado.

## Limites
Dados de navegador e APIs de integração inteiramente fictícios/simulados. Runtime workerd local é real; Firebase/Sheets/Drive de produção não foram exercitados. Nenhuma migração, ativação de cron, alteração de nota/frequência/histórico oficial, configuração de permissão, merge em main ou deploy.
Participação/competências estruturadas, ciclo completo de reposição e retificação formal permanecem dependentes dos fluxos acadêmicos apropriados; o redesign não cria regras paralelas. Leitor de tela e dispositivos físicos ainda pendentes. Contribuições monitoras exigem delegação existente e estrutura disponível; botões não concedem autorização.

## Próxima ação
Revisão da branch combinada; integração controlada somente quando autorizada. Integração real exige cópia e contas autorizadas, conforme decisões institucionais. Não declarar produção validada.

## Resultado do checkpoint
PARCIALMENTE CONCLUÍDO: interface e integração de código testadas; fluxos sem suporte acadêmico estruturado e validação externa/manual permanecem pendentes. Sem declarar produção pronta. Último commit de implementação e integração: `82ec8f9`. Este checkpoint documental registra a validação final.
