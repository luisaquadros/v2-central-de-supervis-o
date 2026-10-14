# PRISMA — Supervisão Acadêmica

Identidade provisória autorizada em 13/10/2026. Nome técnico, repositório, domínio e serviços preservados. Fontes: [especificação consolidada v1.2 e anexo UI/UX](https://docs.google.com/document/d/1AJeFxomAyQrtbkFOOE_igsKCYAJt9dEqwgSRkizJp94/edit), prompt de redesign e documentação do PR #46.

## Design system

Tokens em `src/index.css`, com variantes claras e escuras. Os aliases `--cs-*` e as utilidades legadas continuam compatíveis com os componentes existentes.

| Finalidade | Token | Claro |
|---|---|---|
| Fundo | `--prisma-background` | #F6F4EE |
| Superfície | `--prisma-surface` | #FFFFFF |
| Texto | `--prisma-text` | #253D34 |
| Texto secundário | `--prisma-muted` | #58685E |
| Bordas | `--prisma-border` | #D5C5AD |
| Ação | `--prisma-action` | #344E46 |
| Sucesso / sincronização confirmada | `--prisma-success`, `--prisma-sync-confirmed` | #286348 |
| Alerta / pendente no aparelho | `--prisma-warning`, `--prisma-sync-pending` | #80501D |
| Erro / conflito | `--prisma-error`, `--prisma-sync-conflict` | #9D3631 |
| Informação / foco | `--prisma-info` | #345D71 |
| Seleção | `--prisma-selection` | #E6ECE5 |
| Apoio | `--prisma-sage` | #829584 |
| Detalhes | `--prisma-sand`, `--prisma-terracotta` | #D5C5AD / #C17D68 |

Inter para interface, Fraunces apenas nos títulos editoriais. Fallbacks: system-ui/Segoe UI e Georgia/serif. As fontes externas usam `display=swap`; a interface funciona sem carregá-las. Lucide reaproveitado. Espaçamento 4/8/12/16/24/32 px; cantos 10–14 px; sombras mínimas. Foco visível, movimento reduzido, texto nos estados, alvos móveis de 44 px nas ações principais. Tokens semânticos devem ser usados em novos componentes; utilidades antigas remapeadas permitem migração gradual.

## Navegação e componentes

Desktop: Hoje, Agenda (rota interna `calendario`), Turmas, Avaliações (`avaliacao`) e Acervo. Administração recolhida mantém alunos, frequência, pendências, panorama anterior, semestres e configurações. Mobile: Hoje, Agenda, Turmas, Avaliações e Mais; Acervo acessível em Mais. Perfis restritos não recebem destinos de notas.

Turma: Visão geral, Pessoas (inclui grupos existentes), Acompanhamento (documentação/RSS, leituras, frequência/reposições e pendências), Avaliação. Configuração no cabeçalho. A ficha mantém todas as seções anteriores em seletor contextual e oferece linha do tempo expansível, sem nova cópia de estado. Vínculos explícitos por matrícula prevalecem; vínculos legados ambíguos não são duplicados entre turmas.

Reutilizados: `ModalWrapper`, formulários, metadados Drive, componentes de RSS, preparação de aula, sincronização e serviços canônicos. Componentes comuns: `cs-panel`, `cs-primary-action`, `prisma-tabs`, `prisma-section`, `prisma-empty`, `prisma-meta`. Tabelas modificadas têm apresentação compacta no mobile. Diálogo de chamada e menu móvel contêm foco, fecham por Escape quando seguro e restauram foco.

## Limites funcionais preservados

- Chamada continua NÃO_REGISTRADA antes da prévia e confirmação. Abrir/cancelar prévia não grava. Nenhuma retificação de frequência homologada foi habilitada.
- Pesos/descritores são exibidos quando existentes. Não há cálculo novo nem versão fictícia de rubrica.
- Modificação de arquivo é metadado, não qualidade. Parecer estruturado e revisão de monitoras aguardam módulo autorizado no servidor; nenhuma escrita foi habilitada para contornar a falta desse módulo.
- Diário e retomadas reutilizam pautas/observações existentes. Diário estruturado, participação por evento, competências e homologação versionada continuam pendentes; as anotações não substituem essas entidades.
- O backend do PR #46 ainda pode delegar CHAMADA à monitora. Interface bloqueia modo aula, frequência/editáveis e alterações de encontros nesse perfil; **o requisito de negar no servidor permanece pendente**, pois alterar permissões estava fora do escopo autorizado do redesign.

## Validação reproduzível

`npm run lint`, `npm test`, `npm run build`, `npm run test:worker-real`, `npm audit --audit-level=high` e `npm run test:ui`.

Para testes UI: `npm ci`, `npx playwright install chromium` (ou `CHROMIUM_PATH` para navegador já instalado), `npm run test:ui`. O comando inicia Vite local na porta 4174, cria fixture temporária, bloqueia chamadas externas, simula serviços e remove a fixture ao encerrar. Artefatos em `artifacts/ui-prisma/`, fora do Git. Não usa dados acadêmicos reais.

Verificações: nove telas em claro/escuro, axe com WCAG 2/2.1/2.2 AA, foco/menu, navegação, busca vazia, prévia/cancelamento/confirmação de chamada, restrição visual de monitora, nota digitada preservada na sincronização, erro em modal e lista com 60 estudantes em 320/390/768/1440 px. Axe não substitui avaliação manual por tecnologia assistiva ou dispositivos reais. Não houve validação em produção.
