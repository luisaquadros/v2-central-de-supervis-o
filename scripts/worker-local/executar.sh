#!/usr/bin/env bash
# Valida o Worker REAL (workerd via `wrangler dev --local`) contra uma planilha simulada em loopback.
# Nada sai da máquina: sem token Google, sem planilha oficial, sem dados de estudantes.
# Uso: npm run build && bash scripts/worker-local/executar.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
TMP="$(mktemp -d)"; PORTA_W=8798; export PORTA_MOCK=8799
export NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost WRANGLER_SEND_METRICS=false CI=1
echo '{"keys":[]}' > "$TMP/jwks.json"
node scripts/worker-local/planilha-simulada.mjs $PORTA_MOCK "$TMP/jwks.json" "$TMP/estado.json" > "$TMP/mock.log" 2>&1 & PID_MOCK=$!
npx --yes wrangler@4 dev --local --port $PORTA_W --ip 127.0.0.1 \
  --var ADMIN_EMAILS:professora@exemplo.com \
  --var "SHEETS_API_BASE:http://127.0.0.1:$PORTA_MOCK/v4/spreadsheets/" \
  --var "JWKS_URL:http://127.0.0.1:$PORTA_MOCK/jwks" > "$TMP/wrangler.log" 2>&1 & PID_W=$!
trap 'kill $PID_MOCK $PID_W 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -s --noproxy '*' -o /dev/null http://127.0.0.1:$PORTA_W/ && break; sleep 2; done
curl -s --noproxy '*' -o /dev/null -w '' http://127.0.0.1:$PORTA_W/ || { echo "Worker não iniciou:"; tail -20 "$TMP/wrangler.log"; exit 1; }
node --import tsx scripts/worker-local/cenarios.mts $PORTA_W "$TMP/jwks.json" "$TMP/estado.json"
