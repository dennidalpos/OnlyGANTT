Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:MinimumNodeVersion = [version]'20.0.0'
$script:SupportedNodeVersion = 'Node.js 20 or newer; setup bundles Node.js 24.15.0 x64 LTS'

function Test-VersionAtLeast {
  param(
    [Parameter(Mandatory = $true)]
    [version]$Actual,
    [Parameter(Mandatory = $true)]
    [version]$Minimum
  )

  return $Actual.CompareTo($Minimum) -ge 0
}

function Format-NodePrerequisiteMessage {
  param(
    [string]$Detected = '',
    [string]$NodePath = '',
    [string]$Reason = 'OnlyGANTT runs the server process with Node.js.'
  )

  $details = @(
    'Missing prerequisite: Node.js.',
    "Required version: $script:SupportedNodeVersion.",
    "Why it is required: $Reason",
    'Install action: run OnlyGantt-Setup-<version>-x64.exe to install the bundled official Node.js prerequisite, or install Node.js x64 LTS from https://nodejs.org/ before running the standalone MSI/manual service path.',
    'Verification: run `node --version` in PowerShell and confirm it reports v20.0.0 or newer.'
  )

  if ($Detected) {
    $details += "Detected version: $Detected."
  }

  if ($NodePath) {
    $details += "Detected path: $NodePath."
  }

  return ($details -join ' ')
}

function Get-NodeRuntimeStatus {
  param(
    [string]$NodePath = 'node'
  )

  $resolvedPath = $NodePath
  if ($NodePath -eq 'node') {
    $command = Get-Command node -ErrorAction SilentlyContinue
    if (-not $command) {
      return [pscustomobject]@{
        Found = $false
        Path = ''
        RawVersion = ''
        Version = $null
      }
    }

    $resolvedPath = $command.Source
  } elseif (-not (Test-Path $NodePath)) {
    return [pscustomobject]@{
      Found = $false
      Path = $NodePath
      RawVersion = ''
      Version = $null
    }
  }

  $rawVersion = (& $resolvedPath --version 2>$null).Trim()
  if ($LASTEXITCODE -ne 0 -or $rawVersion -notmatch '^v(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)') {
    return [pscustomobject]@{
      Found = $true
      Path = $resolvedPath
      RawVersion = $rawVersion
      Version = $null
    }
  }

  return [pscustomobject]@{
    Found = $true
    Path = $resolvedPath
    RawVersion = $rawVersion
    Version = [version]"$($Matches.major).$($Matches.minor).$($Matches.patch)"
  }
}

function Assert-NodeRuntime {
  param(
    [string]$NodePath = 'node',
    [string]$Reason = 'OnlyGANTT runs the server process with Node.js.'
  )

  $status = Get-NodeRuntimeStatus -NodePath $NodePath
  if (-not $status.Found) {
    throw (Format-NodePrerequisiteMessage -NodePath $status.Path -Reason $Reason)
  }

  if ($null -eq $status.Version) {
    throw (Format-NodePrerequisiteMessage -Detected $status.RawVersion -NodePath $status.Path -Reason $Reason)
  }

  if (-not (Test-VersionAtLeast -Actual $status.Version -Minimum $script:MinimumNodeVersion)) {
    throw (Format-NodePrerequisiteMessage -Detected $status.RawVersion -NodePath $status.Path -Reason $Reason)
  }

  return $status
}
