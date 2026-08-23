#Requires -Version 5.1
<#
  Odysseus - native Windows launcher (no Docker).

  One command to: create a virtualenv, install dependencies, run first-time
  setup (prints an admin password on first run), and start the server.
  Safe to re-run - it skips whatever already exists.

  Usage:
    powershell -ExecutionPolicy Bypass -File .\launch-windows.ps1
    powershell -ExecutionPolicy Bypass -File .\launch-windows.ps1 -Port 7000 -BindHost 127.0.0.1
    powershell -ExecutionPolicy Bypass -File .\launch-windows.ps1 -NoBrowser

  Once the server responds, your default browser opens automatically.
  Pass -NoBrowser to skip that (e.g. headless / background start).

  Tip: bind 127.0.0.1 (default) for local-only use. Use 0.0.0.0 only when you
  intentionally want other devices on your LAN to reach it.
#>
param(
    [int]$Port = 7000,
    [string]$BindHost = "127.0.0.1",
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Write-Step($msg) { Write-Host ""; Write-Host ("==> " + $msg) -ForegroundColor Cyan }
function Fail($msg) {
    Write-Host ""
    Write-Host ("ERROR: " + $msg) -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

function Test-WindowsBashStub($path) {
    if (-not $path) { return $false }
    $lowered = $path.ToLowerInvariant()
    foreach ($stub in @("system32\bash.exe", "sysnative\bash.exe", "windowsapps\bash.exe")) {
        if ($lowered.Contains($stub)) { return $true }
    }
    return $false
}

function Find-GitBash {
    $cmd = Get-Command bash -ErrorAction SilentlyContinue
    if ($cmd -and -not (Test-WindowsBashStub $cmd.Source)) { return $cmd.Source }

    $roots = @()
    foreach ($name in @("ProgramFiles", "ProgramW6432", "ProgramFiles(x86)", "LocalAppData")) {
        $base = [Environment]::GetEnvironmentVariable($name)
        if ($base) {
            $roots += (Join-Path $base "Git")
            if ($name -eq "LocalAppData") { $roots += (Join-Path $base "Programs\Git") }
        }
    }
    $roots += @("C:\Program Files\Git", "C:\Program Files (x86)\Git")

    foreach ($root in ($roots | Select-Object -Unique)) {
        foreach ($relative in @("bin\bash.exe", "usr\bin\bash.exe")) {
            $candidate = Join-Path $root $relative
            if (Test-Path $candidate) { return $candidate }
        }
    }
    return $null
}

# 1. Locate a Python interpreter (3.11+ required)
Write-Step "Checking for Python"
function Get-PythonVersionText($launcher, $launcherArgs) {
    try {
        return (& $launcher @launcherArgs -c "import sys; print('.'.join(map(str, sys.version_info[:3])))" 2>$null).Trim()
    } catch {
        return $null
    }
}

$pyExe = $null
$pyArgs = @()
$pyVersion = $null

$pyLauncher = Get-Command py -ErrorAction SilentlyContinue
if ($pyLauncher) {
    foreach ($v in @("-3.13", "-3.12", "-3.11")) {
        $ver = Get-PythonVersionText $pyLauncher.Source @($v)
        if ($ver) {
            $pyExe = $pyLauncher.Source
            $pyArgs = @($v)
            $pyVersion = $ver
            break
        }
    }
}

if (-not $pyExe) {
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) {
        $ver = Get-PythonVersionText $pythonCmd.Source @()
        if ($ver) {
            $versionParts = $ver.Split('.')
            $major = [int]$versionParts[0]
            $minor = [int]$versionParts[1]
            if ($major -gt 3 -or ($major -eq 3 -and $minor -ge 11)) {
                $pyExe = $pythonCmd.Source
                $pyVersion = $ver
            }
        }
    }
}

if (-not $pyExe) {
    Fail "Couldn't find Python 3.11+ for Windows setup. Install Python 3.11+ (or open the Python launcher with 'py -3.11') from https://www.python.org/downloads/, then re-run this script."
}
$pythonLabel = ("Using Python {0}: {1} {2}" -f $pyVersion, $pyExe, ($pyArgs -join ' ')).TrimEnd()
Write-Host $pythonLabel

# 2. Create the virtualenv if missing
$venvPy = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    Write-Step "Creating virtual environment (venv)"
    & $pyExe @pyArgs -m venv venv
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $venvPy)) { Fail "Failed to create the virtual environment." }
} else {
    Write-Host "venv already exists - skipping creation."
}

# 3. Install / update dependencies
Write-Step "Installing dependencies (first run can take a few minutes)"
& $venvPy -m pip install --upgrade pip --quiet
& $venvPy -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { Fail "Dependency install failed. Scroll up for the pip error." }

# 4. First-time setup (creates data dirs, DB, .env, admin user)
Write-Step "Running first-time setup"
& $venvPy setup.py
if ($LASTEXITCODE -ne 0) { Fail "setup.py failed." }

# 5. Friendly note about Git Bash (full Cookbook / agent-shell parity)
if (-not (Find-GitBash)) {
    Write-Host ""
    Write-Host "NOTE: Git Bash (bash.exe) was not found on PATH." -ForegroundColor Yellow
    Write-Host "      The core app works without it. For full Cookbook background" -ForegroundColor Yellow
    Write-Host "      downloads and the agent shell tool, install Git for Windows:" -ForegroundColor Yellow
    Write-Host "      https://git-scm.com/download/win" -ForegroundColor Yellow
}

# 6. Point CUDA_PATH at a real CUDA toolkit so GPU llama-cpp-python can import.
$cudaBase = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA"
if (Test-Path $cudaBase) {
    $cudaBest = Get-ChildItem $cudaBase -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path (Join-Path $_.FullName "bin") } |
        Sort-Object { try { [version]($_.Name -replace "^v", "") } catch { [version]"0.0" } } -Descending |
        Select-Object -First 1
    if ($cudaBest) {
        $env:CUDA_PATH = $cudaBest.FullName
        Write-Host ("Using CUDA_PATH = " + $cudaBest.FullName) -ForegroundColor Cyan
    }
}

# 7. Start the server (use `python -m uvicorn` - bare `uvicorn` may not be on PATH)
Write-Step ("Starting Odysseus at http://{0}:{1}" -f $BindHost, $Port)
Write-Host "Press Ctrl+C to stop."
Write-Host ""

# Loopback works even when binding 0.0.0.0 (all interfaces includes localhost),
# and a browser can't be pointed at 0.0.0.0 directly.
$probeHost = if ($BindHost -eq "0.0.0.0") { "127.0.0.1" } else { $BindHost }
$openUrl = "http://{0}:{1}/" -f $probeHost, $Port

$browserJob = $null
if (-not $NoBrowser) {
    # Poll with a real (tiny-timeout) HTTP request in the background and open
    # the default browser the moment the app responds - any status code counts
    # as "ready" (auth middleware may 302/401, that still means it's up), and
    # a real request avoids logging a bogus "Invalid HTTP request" warning the
    # way a bare TCP connect-then-close would.
    $browserJob = Start-Job -ScriptBlock {
        param($url)
        $deadline = (Get-Date).AddSeconds(90)
        $client = [System.Net.Http.HttpClient]::new()
        $client.Timeout = [TimeSpan]::FromMilliseconds(800)
        while ((Get-Date) -lt $deadline) {
            $ready = $false
            try {
                $client.GetAsync($url).GetAwaiter().GetResult() | Out-Null
                $ready = $true
            } catch { }
            if ($ready) {
                Start-Process $url
                return
            }
            Start-Sleep -Milliseconds 400
        }
    } -ArgumentList $openUrl
}

try {
    & $venvPy -m uvicorn app:app --host $BindHost --port $Port
} finally {
    if ($browserJob) {
        Stop-Job $browserJob -ErrorAction SilentlyContinue | Out-Null
        Remove-Job $browserJob -ErrorAction SilentlyContinue | Out-Null
    }
}
