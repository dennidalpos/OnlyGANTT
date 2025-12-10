<#
.SYNOPSIS
    Registra OnlyGANTT come servizio Windows usando NSSM.

.DESCRIPTION
    Questo script installa il webserver OnlyGANTT come servizio Windows.
    Richiede NSSM (Non-Sucking Service Manager) per funzionare.

    Node.js non puo' essere eseguito direttamente come servizio Windows
    perche' non implementa l'API dei servizi Windows. NSSM fa da wrapper.

.PARAMETER ServiceName
    Nome del servizio Windows (default: OnlyGanttWeb)

.PARAMETER DisplayName
    Nome visualizzato del servizio (default: OnlyGANTT Webserver)

.PARAMETER NssmPath
    Percorso all'eseguibile NSSM. Se non specificato, cerca nssm.exe nel PATH
    o nella cartella tools\ del progetto.

.EXAMPLE
    .\register_webserver_service.ps1

.EXAMPLE
    .\register_webserver_service.ps1 -ServiceName "MyGantt" -DisplayName "My Gantt Service"

.NOTES
    Richiede privilegi di amministratore.
    Scaricare NSSM da: https://nssm.cc/download
#>

param(
    [string]$ServiceName = "OnlyGanttWeb",
    [string]$DisplayName = "OnlyGANTT Webserver",
    [string]$NssmPath = ""
)

$ErrorActionPreference = "Stop"

function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }

function Assert-Administrator {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)

    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Error "Esegui questo script da una sessione PowerShell con privilegi di amministratore."
    }
}

function Find-Nssm {
    param([string]$ProvidedPath)

    if ($ProvidedPath -and (Test-Path $ProvidedPath)) {
        return $ProvidedPath
    }

    $nssmCmd = Get-Command nssm -ErrorAction SilentlyContinue
    if ($nssmCmd) {
        return $nssmCmd.Source
    }

    $projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $toolsPaths = @(
        (Join-Path $projectRoot "tools\nssm.exe"),
        (Join-Path $projectRoot "tools\nssm\win64\nssm.exe"),
        (Join-Path $projectRoot "tools\nssm\win32\nssm.exe")
    )

    foreach ($path in $toolsPaths) {
        if (Test-Path $path) {
            return $path
        }
    }

    return $null
}

function Install-Service {
    param(
        [string]$Nssm,
        [string]$Name,
        [string]$Display,
        [string]$NodePath,
        [string]$ServerScript,
        [string]$WorkingDir
    )

    $existingService = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Info "Servizio '$Name' esistente trovato. Rimozione in corso..."

        if ($existingService.Status -ne 'Stopped') {
            Write-Info "Arresto del servizio..."
            & $Nssm stop $Name 2>$null
            Start-Sleep -Seconds 2
        }

        Write-Info "Rimozione del servizio..."
        & $Nssm remove $Name confirm 2>$null
        Start-Sleep -Seconds 1
    }

    Write-Info "Installazione del servizio '$Name'..."
    & $Nssm install $Name $NodePath $ServerScript
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Errore durante l'installazione del servizio."
    }

    Write-Info "Configurazione del servizio..."
    & $Nssm set $Name DisplayName $Display
    & $Nssm set $Name Description "Avvia il webserver OnlyGANTT per la gestione progetti con diagrammi di Gantt"
    & $Nssm set $Name AppDirectory $WorkingDir
    & $Nssm set $Name Start SERVICE_AUTO_START
    & $Nssm set $Name AppStopMethodSkip 0
    & $Nssm set $Name AppStopMethodConsole 3000
    & $Nssm set $Name AppStopMethodWindow 3000
    & $Nssm set $Name AppStopMethodThreads 1000

    $logDir = Join-Path $WorkingDir "logs"
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    & $Nssm set $Name AppStdout (Join-Path $logDir "service-stdout.log")
    & $Nssm set $Name AppStderr (Join-Path $logDir "service-stderr.log")
    & $Nssm set $Name AppRotateFiles 1
    & $Nssm set $Name AppRotateBytes 1048576

    Write-Info "Avvio del servizio..."
    & $Nssm start $Name
    Start-Sleep -Seconds 2

    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq 'Running') {
        Write-Success "Servizio '$Name' installato e avviato con successo!"
    } else {
        Write-Warn "Il servizio e' stato installato ma potrebbe non essere in esecuzione."
        Write-Warn "Verifica con: Get-Service -Name '$Name'"
    }
}

Assert-Administrator

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   OnlyGANTT - Installazione Servizio Windows  " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

$nssm = Find-Nssm -ProvidedPath $NssmPath
if (-not $nssm) {
    Write-Host ""
    Write-Error @"
NSSM (Non-Sucking Service Manager) non trovato.

Node.js non puo' essere eseguito direttamente come servizio Windows.
NSSM e' necessario per creare un wrapper che gestisca il servizio.

Per installare NSSM:
1. Scarica NSSM da: https://nssm.cc/download
2. Estrai l'archivio
3. Copia nssm.exe nella cartella 'tools\' del progetto
   oppure aggiungilo al PATH di sistema

Dopo aver installato NSSM, riesegui questo script.
"@
}

Write-Info "NSSM trovato: $nssm"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverScript = Join-Path $projectRoot "server\server.js"

if (-not (Test-Path $serverScript)) {
    Write-Error "File server non trovato: $serverScript"
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Error "Node.js non trovato nel PATH. Installa Node.js o aggiungilo al PATH."
}

Write-Info "Node.js: $($node.Source)"
Write-Info "Server script: $serverScript"
Write-Info "Directory di lavoro: $projectRoot"
Write-Host ""

Install-Service `
    -Nssm $nssm `
    -Name $ServiceName `
    -Display $DisplayName `
    -NodePath $node.Source `
    -ServerScript $serverScript `
    -WorkingDir $projectRoot

Write-Host ""
Write-Host "Stato del servizio:" -ForegroundColor Cyan
Get-Service -Name $ServiceName | Format-Table Name, DisplayName, Status, StartType -AutoSize

Write-Host ""
Write-Host "Comandi utili:" -ForegroundColor Yellow
Write-Host "  Avviare:    Start-Service -Name '$ServiceName'"
Write-Host "  Fermare:    Stop-Service -Name '$ServiceName'"
Write-Host "  Riavviare:  Restart-Service -Name '$ServiceName'"
Write-Host "  Rimuovere:  .\uninstall_service.ps1 -ServiceName '$ServiceName'"
Write-Host ""
Write-Host "Log disponibili in: $projectRoot\logs\" -ForegroundColor Yellow
Write-Host "Il webserver sara' disponibile su: http://localhost:3000" -ForegroundColor Green
Write-Host ""
