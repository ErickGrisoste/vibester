#!/usr/bin/env bash
# Executa todos os testes de integração dos serviços e imprime estatísticas agregadas.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICES_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TS_SERVICES=(
  "auth-service"
  "user-service"
  "post-service"
  "post-validation-service"
  "event-service"
  "establishment-service"
  "feed-service"
  "scrapping-service"
)

PASS=0
FAIL=0
TOTAL=0
ERRORS=()

run_service() {
  local svc="$1"
  local dir="$SERVICES_DIR/$svc"

  if [ ! -f "$dir/package.json" ]; then
    echo "  [SKIP] $svc: package.json não encontrado"
    return
  fi

  echo ""
  echo "▶ $svc"
  local output
  local exit_code=0

  output=$(cd "$dir" && npm test --silent 2>&1) || exit_code=$?

  local svc_pass svc_fail svc_total
  svc_pass=$(echo "$output" | grep -oP '\d+(?= passed)' | tail -1 || echo "0")
  svc_fail=$(echo "$output" | grep -oP '\d+(?= failed)' | head -1 || echo "0")
  svc_pass=${svc_pass:-0}
  svc_fail=${svc_fail:-0}
  svc_total=$((svc_pass + svc_fail))

  PASS=$((PASS + svc_pass))
  FAIL=$((FAIL + svc_fail))
  TOTAL=$((TOTAL + svc_total))

  if [ "$exit_code" -ne 0 ]; then
    ERRORS+=("$svc")
    echo "  ✗ $svc_fail falhou / $svc_total testes"
    echo "$output" | grep "FAIL\|×" | head -10 | sed 's/^/    /'
  else
    echo "  ✓ $svc_pass/$svc_total testes passaram"
  fi

  # Coverage summary (if available)
  local summary_file="$dir/coverage/coverage-summary.json"
  if [ -f "$summary_file" ]; then
    local lines funcs branches
    lines=$(python3 -c "import json,sys; d=json.load(open('$summary_file')); t=d.get('total',{}); l=t.get('lines',{}); print(f\"{l.get('pct',0):.1f}%\")" 2>/dev/null || echo "n/a")
    funcs=$(python3 -c "import json,sys; d=json.load(open('$summary_file')); t=d.get('total',{}); f=t.get('functions',{}); print(f\"{f.get('pct',0):.1f}%\")" 2>/dev/null || echo "n/a")
    branches=$(python3 -c "import json,sys; d=json.load(open('$summary_file')); t=d.get('total',{}); b=t.get('branches',{}); print(f\"{b.get('pct',0):.1f}%\")" 2>/dev/null || echo "n/a")
    echo "  Coverage: lines=$lines  functions=$funcs  branches=$branches"
  fi
}

echo "============================================"
echo " Vibester — Suíte de Testes de Integração"
echo "============================================"

START_TIME=$(date +%s)

for svc in "${TS_SERVICES[@]}"; do
  run_service "$svc"
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "============================================"
echo " Resultado Final"
echo "============================================"
printf "  Total:   %d testes\n" "$TOTAL"
printf "  Passou:  %d ✓\n" "$PASS"
printf "  Falhou:  %d ✗\n" "$FAIL"
printf "  Tempo:   %ds\n" "$DURATION"
echo ""

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "  Serviços com falhas:"
  for e in "${ERRORS[@]}"; do
    echo "    - $e"
  done
  echo ""
  exit 1
else
  echo "  Todos os serviços passaram! 🎉"
  exit 0
fi
