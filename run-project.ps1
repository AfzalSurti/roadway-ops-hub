param(
  [int]$BackendPort = 4000,
  [int]$FrontendPort = 8081
)

$ErrorActionPreference = "Stop"

function Stop-ListenerOnPort {
  param([int]$Port)

  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $listeners) {
    Write-Host "Port $Port is already free."
    return
  }

  $processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    try {
      $process = Get-Process -Id $processId -ErrorAction Stop
      Write-Host "Stopping PID $processId ($($process.ProcessName)) on port $Port..."
      Stop-Process -Id $processId -Force
    }
    catch {
      Write-Host "Could not stop PID $processId on port $Port."
    }
  }
}

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

if (-not (Test-Path (Join-Path $projectRoot "node_modules"))) {
  Write-Host "Installing dependencies (first run)..."
  npm install
}

Stop-ListenerOnPort -Port $BackendPort
Stop-ListenerOnPort -Port $FrontendPort

$backendCommand = "Set-Location '$projectRoot'; npm run dev"
$frontendCommand = "Set-Location '$projectRoot'; npm run dev:frontend -- --port $FrontendPort"

Write-Host "Starting backend on port $BackendPort..."
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $backendCommand | Out-Null

Write-Host "Starting frontend on port $FrontendPort..."
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $frontendCommand | Out-Null

Start-Sleep -Seconds 3

try {
  $health = Invoke-WebRequest -UseBasicParsing "http://localhost:$BackendPort/health"
  Write-Host "Backend health: $($health.StatusCode)"
}
catch {
  Write-Host "Backend health check failed. Give it a few more seconds and check the backend terminal window."
}

Write-Host ""
Write-Host "Project started."
Write-Host "Frontend: http://localhost:$FrontendPort"
Write-Host "Backend:  http://localhost:$BackendPort/health"