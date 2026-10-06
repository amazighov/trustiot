#!/usr/bin/env bash
set -euo pipefail

wmc_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
wmc_project_root="$(cd -- "${wmc_script_dir}/.." && pwd)"
cd -- "${wmc_project_root}"

if ss -ltn 2>/dev/null | grep -qE '[:.]3000[[:space:]]'; then
  echo "Port 3000 is already in use inside WSL. Stop the existing receiver first." >&2
  exit 1
fi

read -rsp 'Paste the WMC test-wallet private key (input hidden): ' WMC_PRIVATE_KEY
echo
export WMC_PRIVATE_KEY
export TRUSTIOT_AUTO_WMC=true
export TRUSTIOT_AUTO_SYNAPSE_FABRIC=false

wmc_cleanup() {
  unset WMC_PRIVATE_KEY
  unset TRUSTIOT_AUTO_WMC
  unset TRUSTIOT_AUTO_SYNAPSE_FABRIC
}
trap wmc_cleanup EXIT

node receiver.js
