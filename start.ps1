# Chay Recipe App (dung phong cho dong moi)
Write-Host "=== Recipe App - SQL Server ===" -ForegroundColor Cyan
Set-Location $PSScriptRoot

# 1. Kiem tra server dang chay chua
$running = $false
try {
    $r = Invoke-RestMethod "http://localhost:3000/api/home" -TimeoutSec 3
    $running = $true
    Write-Host "Server da chay tai http://localhost:3000" -ForegroundColor Green
} catch {}

if (-not $running) {
    Write-Host "Khoi dong server..." -ForegroundColor Yellow
    Start-Process node -ArgumentList "server/index.js" -WorkingDirectory $PSScriptRoot -WindowStyle Minimized
    Start-Sleep 3
    try {
        $r = Invoke-RestMethod "http://localhost:3000/api/home" -TimeoutSec 5
        Write-Host "Server OK: $($r.featured.Count) mon noi bat" -ForegroundColor Green
    } catch {
        Write-Host "Khong khoi dong duoc! Kiem tra SQL Server va chay: node server/index.js" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Mo trinh duyet..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"
Write-Host ""
Write-Host "Tai khoan demo:" -ForegroundColor Yellow
Write-Host "  admin / admin123  (Quan tri)"
Write-Host "  anh   / 123456    (Nguoi dung)"
Write-Host "  binh  / 123456    (Nguoi dung)"
Write-Host ""
Write-Host "Nhan Enter de tat server (hoac dong cua so nay de gi server chay)..."
Read-Host | Out-Null
