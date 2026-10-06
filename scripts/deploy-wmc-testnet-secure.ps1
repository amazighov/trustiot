$ErrorActionPreference = 'Stop'

$wmcProjectRoot = Split-Path -Parent $PSScriptRoot
$wmcSecretPointer = [IntPtr]::Zero
$wmcPreviousPrivateKey = $env:WMC_PRIVATE_KEY

Push-Location -LiteralPath $wmcProjectRoot
try {
    $wmcSecureKey = Read-Host 'Paste the WMC test-wallet private key (input hidden)' -AsSecureString
    $wmcSecretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($wmcSecureKey)
    $env:WMC_PRIVATE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($wmcSecretPointer)

    npm run wmc:deploy-testnet
    if ($LASTEXITCODE -ne 0) {
        throw "WMC testnet deployment failed with exit code $LASTEXITCODE"
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
