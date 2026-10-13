# Auditoria de usabilidade e estabilidade — 13/10/2026

## Critérios de produto
- Uso principal: supervisão em andamento; leitura, chamada e ficha devem estar a poucos toques
- Navegação: Hoje → Turma → Modo Supervisão; preferir detalhe progressivo e não multiplicar alertas
- Fonte de dados: Google Sheets oficial; IndexedDB é cópia local; status local e remoto devem ser distinguidos
- Sigilo: nada de informação clínica identificável em mensagens de erros, URLs ou relatórios técnicos

## Executado na atualização
| Tema | Mudança | Verificação |
|---|---|---|
| Layout | rolagem da chamada em tela pequena, barras e áreas com altura dinâmica | Compilação; teste manual móvel pendente |
| Identidade | símbolo SVG próprio; favicon e manifesto; tema navy/verde-sálvia/lavanda | Compilação |
| Modo noturno | claro, escuro e acompanhar sistema, escolha persistente; novos tokens de contraste | CSS e compilação; verificação visual em dispositivos pendente |
| Navegação | "Hoje" mais objetivo, próxima turma real, administração recolhida | Compilação |
| Preparação de Aula | itens PAUTA/LEMBRETE/OBSERVACAO por turma e data; concluir, editar, excluir, retomar; persiste em `preparacoes_aula` | Compilação; persistência remota real pendente |
| RSS | semanas faltantes e em revisão mostradas na lista da aula por matrícula e em unidade de grupo; sem sino ou alertas globais; histórico na turma | Testes de regras, leitura real pendente |
| Leituras | título/data/responsáveis reais; cancelamento gera apresentação na próxima aula da mesma turma, preserva responsáveis e outras leituras do dia | Testes automatizados |
| Semanas | prática calculada a partir das datas do calendário, não do número da aula de supervisão | Testes automatizados |
| Aulas canceladas | histórico 05–08/10 armazenado em `encontros_turma` e lido pelo app | Verificar visualização no navegador |
| Login | Firebase persistente + sessão validada no dispositivo até 6h; token de Sheets não guardado no `localStorage` | Testes de duração; OAuth segue limite independente |
| Erros | monitor local captura falhas de renderização, erros de JavaScript e gravação; relatório sem conteúdo acadêmico, sem transmissão automática | Compilação |
| Testes | validação TypeScript, testes operacionais e build em Bun 1.2.15 / 1.4.3 | GitHub Actions |

## Observações de segurança e limitações
1. **Seis horas não significam seis horas de token Google Sheets.** O access token é de curta duração (~55min), e uma reautorização do Google pode ser solicitada antes. A sessão verificada do app é separada da permissão remota e não pode burlar o Google.
2. A Central de Supervisão continua com dois modos de acesso (Google Sheets API e GAS). O fluxo GAS legado não possui paridade com todas as ações e **não é considerado homologado**; a versão web usa API Google.
3. Os componentes `SupervisaoContext.tsx`, `TurmasView.tsx` e `ModoSupervisaoView.tsx` são grandes. Uma extração ampla agora traria risco ao semestre; recomenda-se refatoração incremental após testes de ponta a ponta.
4. Algumas avaliações completas e filas auxiliares ainda são locais ou legado: antes de tratá-las como multi-dispositivo, é necessária normalização e escrita remota segura.
5. O monitor de erros alerta e permite copiar diagnóstico. Não envia chamado automaticamente a ninguém.
6. O app não contém testes de captura visual/e2e em iPhone/iPad/Chrome; compilação **não** valida rolagem física, OAuth popup em Safari nem sincronização bidirecional real.

## Priorização dos próximos testes manuais
1. Abrir e entrar em iPhone Safari, Android e desktop; verificar menus, botão de Chamada, rolagem até última pessoa e alternância claro/escuro
2. Adicionar nota PAUTA para aula futura; atualizar, fechar/reabrir, concluir, trocar de navegador e conferir valor na aba `preparacoes_aula`
3. Confirmar que, em Clínica Ampliada, 1 RSS válido do grupo conta para todas as integrantes; histórico faltante aparece só em Turma/Modo Supervisão
4. Confirmar leitura transferida de aula cancelada para data seguinte da mesma turma, preservando responsável original
5. Confirmar que não há SMS, push, sino ou alerta geral de RSS; chamadas e justificativas continuam notificando
6. Passados 55min e seis horas, conferir comportamento de acesso sem perder informações ainda na fila local
7. Testar erro de rede durante salvar nota/chamada, fila pendente e reenvio sem duplicação

## Repositórios GitHub estudados (não instalados)
- [shadcn/ui](https://github.com/shadcn-ui/ui): componentes acessíveis, layouts e diálogos; adotar de modo incremental, não refazer todas as telas de uma vez
- [Radix Primitives](https://github.com/radix-ui/primitives): foco, teclado, rolagem e acessibilidade de popovers/diálogos
- [TanStack Query](https://github.com/TanStack/query): cache e deduplicação de leituras remotas; só usar após planejar substituição do atual syncQueue, sem dupla fonte de verdade
- [Zod](https://github.com/colinhacks/zod): validar schema e tipos de dados importados para evitar registros inconsistentes
- [Playwright](https://github.com/microsoft/playwright): testes mobile-viewport, navegação, login simulado, atualização de dados e regressões
- Evitar templates inteiros de painel/dashboard: trariam mais páginas redundantes e módulos sem utilidade.

## Checklist antes de declarar a implantação operacional
- GitHub Actions verde em `main`
- Cloudflare Build deployment **success**
- Autenticação real, leitura e gravação remota verificadas em pelo menos dois dispositivos
- Dados antigos preservados e sem duplicação de aulas, matrículas, RSS ou leituras
