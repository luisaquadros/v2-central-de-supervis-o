# Identidade visual — Central de Supervisão Acadêmica

**Escopo:** aplicativo de supervisão dos estágios de Psicologia da Faculdade Anhanguera de Brasília. Esta identidade é própria da Central; **não** importar paletas/logotipos da clínica, do Contexta ou da identidade pessoal da professora.

## Direção criativa
- Profissional, acadêmica, delicada, acolhedora e moderna; leve sem ser infantil.
- Evoluir o desenho existente, sem remodelação desnecessária: sidebar, cards, cabeçalho, painel **Precisa da sua atenção**, navegação móvel inferior e modo de supervisão permanecem.
- Interface enxuta para uso real em sala: contraste, escaneabilidade, hierarquia e respostas visíveis às ações. Poucas sombras; bordas leves e cantos arredondados.
- Dados e funcionalidades nunca desaparecem por uma alteração estética. A identidade visual não modifica lógica de avaliações, segurança, sincronização, sigilo ou regras acadêmicas.

## Tokens canônicos
Definidos em `src/index.css` sob `:root`; utilizar variáveis em novos componentes. Os valores abaixo registram a paleta **já presente no código** (não uma nova paleta institucional aprovada):
| Token | Valor | Uso |
| --- | --- | --- |
| `--cs-navy` | `#15233b` | ações principais, navegação ativa e títulos de grande peso |
| `--cs-teal` | `#2c827e` | foco, interações, detalhe discreto |
| `--cs-orchid` | `#8276b1` | acentos complementares com parcimônia |
| `--cs-canvas` | `#f4f7fa` | fundo geral |
| `--cs-surface` | `#ffffff` | superfície |
| `--cs-ink` | `#15233b` | texto principal |
| `--cs-border` | `#e2e8f0` | linhas e divisórias |

Fontes: **Plus Jakarta Sans** para interface; **JetBrains Mono** apenas para dados técnicos, códigos e números que exigem alinhamento. Aplicar `tabular-nums` a contagens e notas quando cabível. Não depender da fonte remota para funcionalidade.

## Componentes e navegação
- Sidebar desktop: menu simples, estado ativo inequívoco; administração secundária recolhível.
- Mobile: barra inferior com cinco ações e área segura; menu completo acessível pelo item **Mais**, incluindo demais telas.
- Botões e controles têm área de toque confortável (alvo preferencial de 44 px), teclado/foco visível e texto legível.
- Hierarquia: título → contexto/turma → ação principal → dados → detalhes; evitar cards dentro de cards quando não acrescentam significado.
- Feedback imediato de salvar/sincronizar e erros com texto; nunca sinalizar êxito por cor isolada.
- Alertas usam símbolo e texto; preservar **⚠** como indicador de atenção nas listas de alunos, sem criar ruído de vários ícones concorrentes.
- Não pintar nota, risco, ausência ou avaliação com cor como único canal de informação.
- Tablet em paisagem / Modo Supervisão: priorizar visualização dividida ~30% lista e ~70% ficha, sem comprometer rolagem e ações.
- Não converter fluxos operacionais complexos em modais gigantes no telefone; manter navegação contextual e retorno ao aluno/turma de origem.

## Disciplinas
Uma mesma modalidade/ênfase mantém o mesmo acento, independentemente do turno. Os acentos são metadados visuais auxiliares, não códigos de avaliação nem identificadores persistentes. Se não houver mapeamento canônico e confiável da disciplina, utilizar a paleta neutra em vez de classificar pelo nome arbitrariamente.

## Acessibilidade, sigilo e manutenção
- Contraste suficiente, labels, estados de foco, suporte a tema claro/escuro e movimento reduzido.
- Identificadores de pacientes pseudonimizados; não expor informações clínicas em logs, títulos de tela, imagens de divulgação ou exemplos.
- Utilizar `.cs-* ` e tokens canônicos para novos elementos; evitar hexadecimais espalhados. Preservar utilitários Tailwind existentes quando não conflitantes.
- Alterações visuais devem passar por `npm run lint`, `npm test`, `npm run build` e conferência manual em 320/375/768/1024 px e desktop, em ambos os temas.
- Logo Anhanguera: usar somente arquivo oficial fornecido/autorizado, discreto no cabeçalho. Não redesenhar marca nem confundir o ícone próprio da Central com o logo institucional.

**Origem das premissas:** decisões do projeto consolidadas em outubro de 2026; valores cromáticos/fontes auditados no código em 13/10/2026.
