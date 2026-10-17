#!/usr/bin/env bash
# Valida o Worker REAL (workerd via `wrangler dev --local`) contra planilha, Drive e Google simulados em loopback.
# Nada sai da máquina: sem token Google, sem planilha oficial, sem dados de estudantes, com conta de serviço FALSA.
# Uso: npm run build && bash scripts/worker-local/executar.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
TMP="$(mktemp -d)"; PORTA_W=8798; export PORTA_MOCK=8799
export NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost WRANGLER_SEND_METRICS=false CI=1
echo '{"keys":[]}' > "$TMP/jwks.json"
node --import tsx scripts/worker-local/gerar-credenciais.mts "$TMP/sa.json" > /dev/null
setsid node scripts/worker-local/planilha-simulada.mjs $PORTA_MOCK "$TMP/jwks.json" "$TMP/estado.json" > "$TMP/mock.log" 2>&1 & PID_MOCK=$!
ACESSOS='{"monitoras":[{"email":"monitora@exemplo.com","turmas":["t2b"],"operacoes":["CHAMADA","DOCUMENTOS_VER"]}]}'
setsid npx --yes wrangler@4 dev --local --test-scheduled --port $PORTA_W --ip 127.0.0.1 \
  --var ADMIN_EMAILS:professora@exemplo.com \
  --var "ACESSOS_JSON:$ACESSOS" \
  --var "GOOGLE_SERVICE_ACCOUNT_JSON:$(cat "$TMP/sa.json")" \
  --var SINCRONIZACAO_DOCUMENTOS:ligada \
  --var ESTRUTURA_AVALIACAO:ligada \
  --var "SHEETS_API_BASE:http://127.0.0.1:$PORTA_MOCK/v4/spreadsheets/" \
  --var "DRIVE_API_BASE:http://127.0.0.1:$PORTA_MOCK/drive/v3" \
  --var "TOKEN_URL:http://127.0.0.1:$PORTA_MOCK/token" \
  --var "JWKS_URL:http://127.0.0.1:$PORTA_MOCK/jwks" > "$TMP/wrangler.log" 2>&1 & PID_W=$!
# setsid: cada processo lidera o próprio grupo; encerrar o grupo evita deixar o workerd órfão ocupando a porta
trap 'kill -- -$PID_MOCK -$PID_W 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -s --noproxy '*' -o /dev/null http://127.0.0.1:$PORTA_W/ && break; sleep 2; done
curl -s --noproxy '*' -o /dev/null -w '' http://127.0.0.1:$PORTA_W/ || { echo "Worker não iniciou:"; tail -20 "$TMP/wrangler.log"; exit 1; }
node --import tsx scripts/worker-local/cenarios.mts $PORTA_W "$TMP/jwks.json" "$TMP/estado.json"
