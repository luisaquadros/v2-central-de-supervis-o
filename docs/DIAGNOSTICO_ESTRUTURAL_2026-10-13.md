# Diagnóstico estrutural — Central de Supervisão (13/10/2026)

**Conclusão:** a versão atual não está homologada para registrar frequência e acompanhar todos os documentos. O build aprovado não testa gravações ponta a ponta nem integridade das associações acadêmicas. O problema é de consistência entre **fontes externas → planilha intermediária → sincronização/cache → estado React → telas**, além de operações que não persistem.

## Método e limites
- Inspeção da `main` do GitHub, incluindo `SupervisaoContext.tsx`, `syncService.ts`, `googleSheetsService.ts`, `recordIdentity.ts`, `HojeView.tsx`, `ModoSupervisaoView.tsx`, `AlunoFichaView.tsx`, `PendenciasView.tsx` e testes.
- Leitura **sem modificação** das abas da planilha Google **Central de Supervisão - DESENVOLVIMENTO**, inclusive `sincronizacao`, `auditoria_base`, `entregas`, `documentos`, `matriculas`, `frequencias`, `registros_semanais`.
- Conferência no Cloudflare do histórico de builds/deploys. Deploy da `main` commit `300387c9908eedaaf794e6a5542743025528ae22` concluído com sucesso às 08:05:44 UTC.
- **Sem navegação autenticada em iPhone, sem teste de mutações reais e sem inspecionar IndexedDB dos dispositivos**. Riscos derivados de código não equivalem a ocorrência comprovada com dados privados.

## Inventário da planilha (consulta de 13/10)
| Tabela | Linhas | Nota |
|---|---:|---|
| turmas | 6 | seis ativas |
| matrículas | 86 | correspondem a 83 pessoas acadêmicas (matrículas não são pessoas únicas) |
| entregas | 258 | 86 × 3 itens documentais |
| documentos | 1 | o único documento aponta para matrícula ausente da tabela atual |
| registros_semanais | 201 | 38 pendentes de revisão / sem semana identificada em auditoria anterior |
| status_rss_unidades | 63 | consolidados por matrícula ou grupo |
| frequencias | 26 | 15 `PRESENTE`, 11 `ATRASO` |
| encontros_turma | 7 | estados registrados separadamente de frequência |
| leituras_responsaveis | 57 | calendário de leituras |
| turmas_origem | 12 | sem vínculo canônico por aluno na matrícula |
| configuracoes | 3 | nenhuma resolução administrativa gravada até esta leitura |

## Falhas comprovadas e riscos

| ID | Gravidade | Evidência / causa | Consequência |
|---|---|---|---|
| F01 | **P0** | `src/context/SupervisaoContext.tsx`: operações `addCaixaEntradaItem`, `confirmarCaixaEntradaItem`, `descartarCaixaEntradaItem`, `addItemFilaProfessora`, `toggleStatusFilaProfessora`, `addItemFilaSupervisao`, `updateStatusFilaSupervisao`, `aprovarDevolutiva` e `registrarEnvioDevolutiva` só alteram estado React. | Ações parecem concluídas, mas podem desaparecer na recarga/sincronização. |
| F02 | **P0** | `src/views/ModoSupervisaoView.tsx` interpreta `f.status !== 'PRESENTE'` como falta; porém 11 linhas oficiais de `frequencias` usam `ATRASO`, não contemplado em `types/index.ts`. | Presença com atraso pode ser exibida como ausência e sobrescrita ao salvar a chamada. |
| F03 | **P0** | `salvarChamadaPorExcecao` atualiza `encontrosTurma` para `REALIZADO` em memória, mas só enfileira/grava `frequencias` e `ocorrencias`, não o encontro correspondente. | Contagem, aula encerrada, chamada pendente e status do encontro podem divergir entre dispositivos. |
| F04 | **P0** | Os status oficiais de documentação estão em `entregas` (258), mas a ficha usa `documentos` (1 registro, órfão); várias métricas consultam apenas `documentos`. | Documentos não aparecem, não correspondem às entregas ou geram pendências incorretas. |
| F05 | **P0** | A aba `sincronizacao` informa `CENTRAL_CONTROLE` = `CONFIGURADA_PENDENTE_CONECTOR`, registros lidos/atualizados = **0**, apesar do rótulo `CONECTADO`. | Base intermediária de documentos pode estar desatualizada em relação ao arquivo de origem. |
| F06 | **P0** | `aplicarDados` carrega cache IndexedDB e `connectionStatus='CONECTADO'` antes de comprovar consulta remota; em erro de sincronização, presença de cache mantém `CONECTADO`. | Sinal enganoso de atualização e dados antigos em telas. |
| F07 | **P1** | `reagendarEncontro` persiste encontros, mas atualiza as leituras transferidas apenas com `setLeiturasResponsaveis`. | Responsáveis/leituras podem reaparecer na data antiga após sincronização. |
| F08 | **P1** | `identificarSupervisaoAtual` percorre turmas na ordem da planilha e pode retornar um cancelamento sem horário no dia; `identificarProximaSupervisao` não ordena horários/turmas globalmente. | Tela Hoje pode destacar turma errada, omitir aulas e parecer presa em um encontro concluído. A correção está em branch PR #29, **não integrada**. |
| F09 | **P1** | `registros_semanais` possui 201 registros; 38 em `PENDENTE_REVISAO`; indicadores de `status_rss_unidades` podem ser maiores que semanas comprovadas por formulário. | RSS visível ≠ semana validada ≠ consolidado; há divergências justificadas, mas precisam ser mostradas e rastreadas sem imputar faltas. |
| F10 | **P1** | `matriculas` não tem `origem_id` nem `codigo_origem`; há 12 entradas em `turmas_origem`. `setOrigemDoAluno` bloqueia a gravação. | Código individual do Docente Online não pode ser resolvido corretamente sem ampliar o contrato de dados. |
| F11 | **P1** | `registrarAuditoria` só usa `setAuditoriaApp`. `exportDatabaseAsJson` não inclui caixa de entrada, filas, `avaliacoesCompletas`, preparações e encontros. | Trilha de auditoria e exportação não cobrem todas as operações/dados do sistema. |
| F12 | **P1** | O sino usa `getPendenciasCanonicas`, mas a página agrega a lista total e também exibe quatro categorias com filtros diferentes; há ainda resolução administrativa via `configuracoes` sem atualizar a fonte da obrigação. | Contagens e visões parecem contraditórias; pendência ocultada não significa dado acadêmico regularizado. |
| F13 | **P1** | `recordIdentity('configuracoes')` usa apenas `chave`, enquanto resolução considera também `periodo_id`. | Uma mesma chave lógica em períodos diferentes pode conflitar. |
| F14 | **P1** | `auditoria_base` apresenta 47 verificações OK, uma REVISAR (38 RSS) e uma célula com `#ERROR!` na verificação de `dia_semana`. | A base não pode ser declarada totalmente íntegra enquanto a auditoria também tem erro. |
| F15 | **P2** | `src/views/ModoAulaView.tsx` é uma implementação distinta, mas o `App.tsx` usa `ModoSupervisaoView.tsx`. | Correções aplicadas ao componente não utilizado não aparecem no aplicativo. |
| F16 | **P0 (cobertura)** | `npm test` executa testes TypeScript/Node; não há suíte E2E de navegação autenticada, iPhone/PWA e persistência real Google Sheets → app → Google Sheets. | Build verde não comprova integridade de gravações, UI nem sincronização entre dispositivos. |

### Interpretação das fontes
`fonte_central_controle` e `entregas` são importações da origem, não prova de sincronização contínua. `registros_semanais` é composto por respostas validadas, históricas e pendentes. `status_rss_unidades` é consolidado, não texto de RSS. `documentos` contém documentos específicos do serviço-escola, mas não é equivalente a `entregas`. `encontros_turma` é o status da aula; `frequencias` representa a chamada individual. Esses contratos precisam estar explícitos e ser usados por todas as telas.

## Plano de reparação (ordem obrigatória)
**Fase 0 — Contenção de risco antes do próximo uso**
1. Impedir regravação de registros `ATRASO` como faltas; preservar o significado da fonte e vincular atraso como propriedade de presença.
2. Gravar o fechamento da chamada e as frequências como operação reconciliável, identificada por turma + data; mostrar confirmação remota vs local e pendência de outbox.
3. Não permitir operação “salva” para funções somente em memória. Persistir corretamente ou identificar visivelmente a função como indisponível/rascunho.
4. Não apagar cache nem fila de alterações pendentes. Gerar backup protegido antes de migrações.

**Fase 1 — Contrato de dados e ingestão**
1. Mapear as fontes originais e definir um único conjunto de tabelas canônicas para cada domínio (turmas/matrículas, chamada, documentos, RSS, leituras, pendências e avaliações).
2. Implementar **conector automático idempotente** Central de Controle → `entregas`, com `lastSync`, contagens reconciliadas, erros e política de conflitos. Até lá marcar claramente “snapshot/importado”.
3. Criar o vínculo individual matrícula → origem do Docente Online; só preencher com evidência, sem distribuir códigos por ordem.
4. Corrigir registros órfãos, inconsistências da auditoria e regras de estados sem destruir o histórico.

**Fase 2 — Estado único e sincronização**
1. Usar um único serviço de leitura/consulta normalizado para todas as telas e evitar cálculos divergentes nos componentes.
2. Diferenciar visualmente `CACHE_LOCAL`, `REMOTO_CONFIRMADO`, `PENDENTE`, `ERRO` e `CONFLITO` com hora e quantidade de registros por tabela.
3. Persistir eventos de estudo dirigido, devolutivas, filas e caixa de entrada; incluir todos no backup e auditoria.
4. Definir regras de resolução de pendências rastreáveis por origem e evento; confirmação administrativa não equivale a entrega/regularização.

**Fase 3 — Interfaces e testes**
1. Testar as **seis turmas**, a lista de chamada e os RSS em desktop, iPhone Safari e atalho PWA.
2. Implementar E2E de uma entrega, uma alteração de frequência, um fechamento de aula, uma justificativa, uma mudança de responsável e uma pendência resolvida; validar leitura após recarga, novo login e segundo dispositivo.
3. Exercitar sincronização offline/reconexão, token vencido, resposta parcial de aba, duplicidade e concorrência entre abas.
4. Só integrar e publicar após checagem de integridade sem P0; comparar build/deploy SHA com a `main` e registrar versão no aplicativo.

## Critérios para considerar pronto
- Todas as seis turmas conferem com matrícula/código de origem/horário da planilha.
- Nenhum status `ATRASO` é convertido em falta.
- Chamadas e encerramentos de encontro aparecem iguais em dois dispositivos após sincronização.
- Documentação acadêmica apresenta os 258 registros com status originais; documentos específicos são apresentados separadamente, sem duplicar.
- RSS individual e grupal exibem apenas registros vinculados corretamente; semanas indefinidas e pendentes de revisão não contam como válidas.
- Toda ação que diz “salvo” sobrevive a recarga, logout e login.
- Botão “pendência resolvida” persiste e não mascara obrigação ainda não regularizada.
- Fonte Central de Controle informa situação real do conector, não apenas “conectado”.
- Testes automatizados **e** testes E2E com execução real documentada.

## Estado de publicação na data da auditoria
O Cloudflare indica deploy da `main` `300387c9908eedaaf794e6a5542743025528ae22` concluído; isso prova publicação dessa versão, **não** a resolução dos problemas acima. A PR #29 de Hoje/documentação ainda está aberta. Não publicar automaticamente essa branch antes de encerrar os riscos P0.
