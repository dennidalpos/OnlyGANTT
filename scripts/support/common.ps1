Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ScriptRoot
  )

  return (Resolve-Path (Join-Path $ScriptRoot '..\..')).Path
}

function Get-ArtifactsRoot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  return (Join-Path $RepoRoot 'artifacts')
}

function Ensure-Directory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Ensure-ArtifactsLayout {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  $artifactsRoot = Get-ArtifactsRoot -RepoRoot $RepoRoot
  foreach ($relativePath in @(
    '',
    'build',
    'test-results',
    'packages',
    'publish',
    'logs'
  )) {
    $targetPath = if ([string]::IsNullOrEmpty($relativePath)) {
      $artifactsRoot
    } else {
      Join-Path $artifactsRoot $relativePath
    }

    Ensure-Directory -Path $targetPath
  }
}

function Assert-CommandExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Assert-PathExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  if (-not (Test-Path $Path)) {
    throw "$Label not found: $Path"
  }
}

function Get-NodeVersionInfo {
  Assert-CommandExists -Name 'node'

  $rawVersion = (& node --version).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to resolve Node.js version.'
  }

  if ($rawVersion -notmatch '^v(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)') {
    throw "Unsupported Node.js version format: $rawVersion"
  }

  return [pscustomobject]@{
    Raw = $rawVersion
    Major = [int]$Matches.major
    Minor = [int]$Matches.minor
    Patch = [int]$Matches.patch
  }
}

function Reset-ManagedDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  Ensure-Directory -Path $Path

  Get-ChildItem -Path $Path -Force | ForEach-Object {
    if ($_.Name -eq '.gitkeep') {
      return
    }

    Remove-Item -Path $_.FullName -Recurse -Force
  }
}

function Write-Utf8File {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  $parentPath = Split-Path -Path $Path -Parent
  if ($parentPath) {
    Ensure-Directory -Path $parentPath
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}
