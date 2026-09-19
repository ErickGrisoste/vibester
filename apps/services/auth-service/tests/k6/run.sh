#!/usr/bin/env bash
set -e

# ──────────────────────────────────────────────
# Configurações padrão (sobrescreva via env)
# ──────────────────────────────────────────────
BASE_URL="${BASE_URL:-http://cotaup.com.br:3001}"
INFLUXDB_URL="${INFLUXDB_URL:-http://cotaup.com.br:8086/k6}"

PERF_VUS="${PERF_VUS:-50}"
STRESS_VUS="${STRESS_VUS:-200}"
BREAK_VUS="${BREAK_VUS:-500}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_test() {
  local scenario="$1"
  local script="${SCRIPT_DIR}/scenarios/${scenario}.js"

  echo ""
  echo "════════════════════════════════════════════"
  echo " Iniciando: ${scenario}"
  echo " Base URL : ${BASE_URL}"
  echo " InfluxDB : ${INFLUXDB_URL}"
  echo "════════════════════════════════════════════"

  k6 run \
    --out "influxdb=${INFLUXDB_URL}" \
    -e BASE_URL="${BASE_URL}" \
    -e PERF_VUS="${PERF_VUS}" \
    -e STRESS_VUS="${STRESS_VUS}" \
    -e BREAK_VUS="${BREAK_VUS}" \
    "${script}"
}

# ──────────────────────────────────────────────
# Uso: ./run.sh [performance|stress|breakpoint|all]
# ──────────────────────────────────────────────
SCENARIO="${1:-performance}"

case "${SCENARIO}" in
  performance)  run_test performance ;;
  stress)       run_test stress ;;
  breakpoint)   run_test breakpoint ;;
  verify-email) run_test verify-email ;;
  all)
    run_test performance
    echo "Aguardando 30s para o serviço estabilizar..."
    sleep 30
    run_test stress
    echo "Aguardando 60s para o serviço estabilizar..."
    sleep 60
    run_test breakpoint
    echo "Aguardando 60s para o serviço estabilizar..."
    sleep 60
    run_test verify-email
    ;;
  *)
    echo "Uso: $0 [performance|stress|breakpoint|verify-email|all]"
    echo ""
    echo "Variáveis de ambiente opcionais:"
    echo "  BASE_URL      URL do auth-service  (default: http://cotaup.com.br:3001)"
    echo "  INFLUXDB_URL  URL do InfluxDB       (default: http://cotaup.com.br:8086/k6)"
    echo "  PERF_VUS      VUs performance test  (default: 50)"
    echo "  STRESS_VUS    VUs stress test       (default: 200)"
    echo "  BREAK_VUS     VUs breakpoint test   (default: 500)"
    exit 1
    ;;
esac
