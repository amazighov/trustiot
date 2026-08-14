#!/usr/bin/env bash
set -euo pipefail

echo "TrustIoT prerequisite check"

if command -v node >/dev/null 2>&1; then
  echo "✓ node: $(node --version)"
else
  echo "✗ node not found"
fi

if command -v filecoin-pin >/dev/null 2>&1; then
  echo "✓ filecoin-pin: $(filecoin-pin --version 2>/dev/null || echo installed)"
else
  echo "• filecoin-pin not installed (only needed for Filecoin integration)"
fi

if command -v docker >/dev/null 2>&1; then
  echo "✓ docker: $(docker --version)"
else
  echo "• docker not found (needed later for Fabric test network)"
fi
