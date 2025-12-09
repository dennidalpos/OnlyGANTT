param(
    [string]$ServiceName = "OnlyGanttWeb",
    [string]$DisplayName = "OnlyGANTT Webserver"
)

function Assert-Administrator {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)

    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Error "Esegui questo script da una sessione PowerShell con privilegi di amministratore." -ErrorAction Stop
    }
}

Assert-Administrator

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path (Join-Path $scriptDir ".." -ErrorAction Stop)).ProviderPath
$serverScript = Join-Path $projectRoot "server\server.js"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Error "Node.js non è stato trovato nel PATH. Installa Node.js o aggiungilo al PATH corrente." -ErrorAction Stop
}

$binaryPath = '"{0}" "{1}"' -f $node.Source, $serverScript

$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    if ($existingService.Status -ne 'Stopped') {
        Write-Host "Arresto del servizio esistente $ServiceName..."
        Stop-Service -Name $ServiceName -Force -ErrorAction Stop
    }

    Write-Host "Rimozione del servizio esistente $ServiceName..."
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 1
}

Write-Host "Creazione del servizio $ServiceName..."
New-Service \
    -Name $ServiceName \
    -DisplayName $DisplayName \
    -BinaryPathName $binaryPath \
    -Description "Avvia il webserver OnlyGANTT tramite Node.js" \
    -StartupType Automatic \
    -ErrorAction Stop

Set-Service -Name $ServiceName -StartupType Automatic
Start-Service -Name $ServiceName

Write-Host "Servizio creato e avviato. Stato corrente:"
Get-Service -Name $ServiceName | Select-Object Name, DisplayName, Status, StartType
