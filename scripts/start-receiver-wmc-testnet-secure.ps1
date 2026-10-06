$ErrorActionPreference = 'Stop'

$wmcProjectRoot = Split-Path -Parent $PSScriptRoot
$wmcSecretPointer = [IntPtr]::Zero
$wmcPreviousPrivateKey = $env:WMC_PRIVATE_KEY
$wmcPreviousAutoWmc = $env:TRUSTIOT_AUTO_WMC
$wmcPreviousAutoStorage = $env:TRUSTIOT_AUTO_SYNAPSE_FABRIC

Push-Location -LiteralPath $wmcProjectRoot
try {
    $wmcPortInUse = Test-NetConnection `
        -ComputerName '127.0.0.1' `
        -Port 3000 `
        -InformationLevel Quiet `
        -WarningAction SilentlyContinue
    if ($wmcPortInUse) {
        throw 'Port 3000 is already in use. Stop the existing receiver before entering the wallet key.'
    }

    $wmcSecureKey = Read-Host 'Paste the WMC test-wallet private key (input hidden)' -AsSecureString
    $wmcSecretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($wmcSecureKey)
    $env:WMC_PRIVATE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($wmcSecretPointer)
    $env:TRUSTIOT_AUTO_WMC = 'true'
    $env:TRUSTIOT_AUTO_SYNAPSE_FABRIC = 'false'

    node receiver.js
    if ($LASTEXITCODE -ne 0) {
        throw "TrustIoT WMC receiver failed with exit code $LASTEXITCODE"
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
    if ($null -eq $wmcPreviousAutoWmc) {
        Remove-Item Env:TRUSTIOT_AUTO_WMC -ErrorAction SilentlyContinue
    }
    else {
        $env:TRUSTIOT_AUTO_WMC = $wmcPreviousAutoWmc
    }
    if ($null -eq $wmcPreviousAutoStorage) {
        Remove-Item Env:TRUSTIOT_AUTO_SYNAPSE_FABRIC -ErrorAction SilentlyContinue
    }
    else {
        $env:TRUSTIOT_AUTO_SYNAPSE_FABRIC = $wmcPreviousAutoStorage
    }
    Remove-Variable wmcSecureKey -ErrorAction SilentlyContinue
    Pop-Location
}
