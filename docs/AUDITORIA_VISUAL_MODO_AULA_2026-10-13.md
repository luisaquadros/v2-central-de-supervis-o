# Auditoria de identidade visual — Modo Aula e RSS (13/10/2026)

## Escopo e evidência
Análise estática de `src/index.css`, `src/views/ModoSupervisaoView.tsx`, `src/views/AlunoFichaView.tsx`, `src/components/LeituraRss.tsx` e `docs/IDENTIDADE_VISUAL.md`. **Não substitui inspeção visual em dispositivos reais.**

### Pontos preservados
- Paleta documentada: navy `#15233b`, teal `#2c827e`, orchid `#8276b1`; superfícies neutras.
- Fontes Plus Jakarta Sans e JetBrains Mono; estado de foco visível e suporte a tema escuro.
- Fluxo de lista e detalhe do Modo Aula; operações e armazenamento não devem mudar por razões estéticas.

### Melhorias priorizadas
| Prioridade | Problema observado | Ajuste recomendado | Critério de validação |
| --- | --- | --- | --- |
| P0 | Na ficha, muitos rótulos e controles usam `text-[10px]` / `text-[11px]`; leitura cansativa no celular | Elevar texto de conteúdo a 14–15px, metadados a 12px e usar 44px para ações recorrentes | Testar 320/375 px e zoom 200% |
| P0 | Alto impacto de uma lista de presença não confiável | Contagem clara de matrículas encontradas vs esperadas; bloquear salvar quando incompleta (PR #17) | Conferir cada turma com base oficial |
| P1 | Ações da mesma importância alternam `bg-slate-900`, verde e índigo | Navy para ação primária, teal para foco/links, sem mudar cores semânticas de erro, atraso e êxito | Hierarquia e contraste AA |
| P1 | Tela de supervisão concentra muitas ações na faixa superior | Priorizar Chamada → Discussão → Registro; ações secundárias em menus discretos | Modo Aula utilizável com uma mão |
| P1 | RSS eram status em cartões sem leitura contínua | Blocos expansíveis com corpo de 15px/1.65, links acessíveis e texto pré-formatado | Ler 12 registros sem perda de contexto |
| P2 | Dados de estudantes são exibidos com termos repetidos e muitos cartões | Reduzir repetição de “RSS” e manter resumo de uma linha acima dos detalhes | Nenhuma informação suprimida |
| P2 | No modo escuro, links teal com cor fixa têm contraste insuficiente | Usar cor específica para links no tema escuro | Contraste e foco por teclado |
| P2 | Uso frequente de `font-mono` em métricas | Reservar mono a RA, datas e números; texto corrido em fonte principal | Maior legibilidade |

## Implementado nesta rodada
- CSS `.cs-reading-copy`: texto de leitura RSS a 15px, entrelinha 1.65, largura limitada por linha.
- CSS `.cs-reading-link`: teal de alto contraste no claro e versão clara no modo escuro.
- Área mínima de 44px nos cabeçalhos expansíveis dos registros, preservando estrutura existente.

## Restrições de segurança e informação
- Não alterar identificadores, controle de acesso, lógica de salvamento e estados de sincronização.
- Não usar cor como única indicação de ausência ou pendência.
- Não inserir casos reais ou dados de pacientes em exemplos, prints, telemetria ou relatórios públicos.

## Próxima validação manual
1. Em celular (320/375px), conferir cabeçalho, lista completa da chamada, troca de aluno, abertura dos RSS e retorno.
2. Em tablet (768px), confirmar lista + ficha, sem corte da coluna nem rolagem travada.
3. Em desktop, conferir estados de sincronização e densidade dos cartões.
4. Modo claro/escuro, foco por teclado e texto ampliado.
5. Comparar a contagem de matrículas e o conteúdo RSS com a planilha **real autorizada** antes de homologar a supervisão.
