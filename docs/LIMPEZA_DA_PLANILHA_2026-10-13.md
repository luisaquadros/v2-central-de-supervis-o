# Limpeza da planilha — o que dá para arquivar e o que NÃO pode ser apagado

Levantamento **somente de leitura** (nada foi apagado ou alterado) da planilha *Central de Supervisão — DESENVOLVIMENTO*, em 13/10/2026.
Método: para cada aba, (1) se o app a lê, (2) quantas linhas tem, (3) se fórmulas de **outras** abas dependem dela.

**Resumo:** 60 abas. O app lê 37. As outras 23 se dividem em quatro grupos abaixo.

## 🔴 Não apagar (fórmulas de outras abas dependem delas)
| Aba | Linhas | Quem depende |
|---|---:|---|
| `fonte_registro_semanal` | 203 | `registros_semanais`, `registros_semanais_auto`, `auditoria_base` |
| `registros_semanais_historico` | 163 | `registros_semanais`, `registros_semanais_auto` |

O app não as lê, mas o RSS que ele mostra nasce delas. Apagar quebra `registros_semanais`.

## 🟡 Fontes originais — manter até a professora confirmar que já foram conferidas
`fonte_central_controle` (97), `fonte_notas_parciais_2026` (89), `fonte_freq_caderno_2026` (693), `conciliacao_notas_2026` (14) e as seis abas `RSS - …` (uma por turma).
Nenhuma fórmula depende delas, mas guardam a origem dos dados importados (permitem conferir o que foi importado).

## 🟢 Candidatas a arquivar ou apagar (nenhuma fórmula depende delas; o app não lê)
| Aba | Linhas | Motivo |
|---|---:|---|
| `Página1` | 0 | Vazia (só uma célula de teste) |
| `_RASCUNHO_alunos_validados` | 83 | Rascunho de validação de nomes |
| `_RASCUNHO_matriculas_validadas` | 86 | Rascunho |
| `_RASCUNHO_alunos_reais` | 86 | Rascunho |
| `_RASCUNHO_matriculas_reais` | 90 | Rascunho |
| `_RASCUNHO_backup_matriculas_v12` | 15 | Backup antigo |
| `_RASCUNHO_backup_frequencias_v1` | 1 | Backup antigo (só cabeçalho) |
| `registros_semanais_auto` | 203 | Cópia por fórmula de `registros_semanais`, sem uso por outras abas (~5,6 mil fórmulas pesam na planilha) |

**Antes de apagar:** fazer uma cópia do arquivo (Arquivo → Fazer uma cópia). Os rascunhos têm dados de estudantes; apague-os depois de confirmar que a base oficial (`alunos`, `matriculas`) está correta.

## ⚪ Referência/documentação (manter ou mover para outro arquivo)
`regras_turma` (11), `cronograma_referencia` (34), `validacao_kls` (21).
Não são lidas pelo app. `validacao_kls` pode ser a melhor pista para mapear o código individual do Docente Online de cada estudante (hoje a aba `matriculas` não tem `origem_id`).

## Abas que o app lê mas estão (quase) vazias
`documentos` (1 linha, órfã: aponta para matrícula inexistente — a ficha agora usa `entregas`), `sincronizacao`, `contrato_app`, `mapeamento_fontes`, `dicionario_dados`, `regras_prazo`. São documentação do contrato de dados; o app só as lê, não depende do conteúdo.
