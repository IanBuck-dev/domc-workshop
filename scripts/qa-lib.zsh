#!/bin/zsh
set -eu
qa_run() {
  local gate="$1"; shift
  local dir=".local/validation-runs" stamp log start end
  mkdir -p "$dir"
  stamp=$(date +%Y%m%d-%H%M%S); log="$dir/$stamp-$gate.log"; start=$(date +%s)
  if "$@" >"$log" 2>&1; then
    end=$(date +%s); echo "$gate OK $((end-start))s"
  else
    end=$(date +%s); echo "$gate FEHLER $((end-start))s — $*"
    rg -n "error|Error|FAIL|failed|✗|TS[0-9]{4}" "$log" | head -20 || tail -20 "$log"
    echo "Vollständiges Log: $log"; return 1
  fi
}
