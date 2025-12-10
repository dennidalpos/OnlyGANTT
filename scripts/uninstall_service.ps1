<#
.SYNOPSIS
    Rimuove il servizio Windows OnlyGANTT.

.DESCRIPTION
    Questo script arresta e rimuove il servizio Windows OnlyGANTT
    precedentemente installato con register_webserver_service.ps1.

.PARAMETER ServiceName
    Nome del servizio da rimuovere (default: OnlyGanttWeb)

.PARAMETER NssmPath
    Percorso all'eseguibile NSSM. Se non specificato, cerca nssm.exe nel PATH
    o nella cartella tools\ del progetto.

.EXAMPLE
    .\uninstall_service.ps1

.EXAMPLE
    .\uninstall_service.ps1 -ServiceName "MyGantt"

.NOTES
    Richiede privilegi di amministratore.
#>

param(
    [string]$ServiceName = "OnlyGanttWeb",
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

Assert-Administrator

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   OnlyGANTT - Rimozione Servizio Windows      " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $existingService) {
    Write-Warn "Il servizio '$ServiceName' non esiste."
    exit 0
}

$nssm = Find-Nssm -ProvidedPath $NssmPath

if ($existingService.Status -ne 'Stopped') {
    Write-Info "Arresto del servizio '$ServiceName'..."
    if ($nssm) {
        & $nssm stop $ServiceName 2>$null
    } else {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

Write-Info "Rimozione del servizio '$ServiceName'..."
if ($nssm) {
    & $nssm remove $ServiceName confirm
} else {
    sc.exe delete $ServiceName | Out-Null
}

Start-Sleep -Seconds 1

$checkService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($checkService) {
    Write-Warn "Il servizio potrebbe richiedere un riavvio del sistema per essere completamente rimosso."
} else {
    Write-Success "Servizio '$ServiceName' rimosso con successo!"
}

Write-Host ""
