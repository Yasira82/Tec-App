#!/bin/bash
set -euo pipefail

# Only run in remote web sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

C02="/home/user/tec-knowledge-base/knowledge-base/C-02___CURRENT_STATE_.md"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   TEC PLATFORM — CURRENT STATE (C-02)   ║"
echo "╚══════════════════════════════════════════╝"

if [ -f "$C02" ]; then
  cat "$C02"
else
  echo "⚠️  C-02 not found locally."
  echo "→ Fetch from: yasira82/tec-knowledge-base"
  echo "→ Branch: claude/gifted-knuth-1yhom3"
  echo "→ File: knowledge-base/C-02___CURRENT_STATE_.md"
fi

echo ""
echo "══════════════════════════════════════════"
