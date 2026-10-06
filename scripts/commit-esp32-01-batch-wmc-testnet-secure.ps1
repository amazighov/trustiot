$ErrorActionPreference = 'Stop'

$wmcProjectRoot = Split-Path -Parent $PSScriptRoot
$wmcSecretPointer = [IntPtr]::Zero
$wmcPreviousPrivateKey = $env:WMC_PRIVATE_KEY
$wmcBatchPath = 'artifacts/batches/esp32-01-batch-1791236131-1791236450-f6b038e9a02d.json'

Push-Location -LiteralPath $wmcProjectRoot
try {
    if (-not (Test-Path -LiteralPath $wmcBatchPath)) {
        throw "Telemetry batch not found: $wmcBatchPath"
    }

    $wmcSecureKey = Read-Host 'Paste the WMC test-wallet private key (input hidden)' -AsSecureString
    $wmcSecretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($wmcSecureKey)
    $env:WMC_PRIVATE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($wmcSecretPointer)

    node src/wmc-commit-batch.js $wmcBatchPath
    if ($LASTEXITCODE -ne 0) {
        throw "WMC batch commitment failed with exit code $LASTEXITCODE"
    }
}
finally {
    if ($wmcSecretPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($wmcSecretPointer)
    }
    if ($null -eq $wmcPreviousPrivateKey) {
        Remove-Item Env:WMC_PRIVATE_KEY -ErrorAction SilentlyContinue
    }
    else {
        $env:WMC_PRIVATE_KEY = $wmcPreviousPrivateKey
    }
    Remove-Variable wmcSecureKey -ErrorAction SilentlyContinue
    Pop-Location
}
