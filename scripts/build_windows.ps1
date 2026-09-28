$ErrorActionPreference = "Stop"

Write-Host "[1/4] Creating isolated build environment..." -ForegroundColor Cyan
if (-not (Test-Path ".venv-build")) {
    py -3.11 -m venv .venv-build
}

$Python = Join-Path $PWD ".venv-build\Scripts\python.exe"
$PyInstaller = Join-Path $PWD ".venv-build\Scripts\pyinstaller.exe"

Write-Host "[2/4] Installing build dependencies..." -ForegroundColor Cyan
& $Python -m pip install --upgrade pip
& $Python -m pip install -r requirements-build.txt

Write-Host "[3/4] Running tests..." -ForegroundColor Cyan
& $Python -m unittest discover -s tests -v

Write-Host "[4/4] Building Mi3rab.exe..." -ForegroundColor Cyan
& $PyInstaller --noconfirm --clean Mi3rab.spec

$Hash = (Get-FileHash -Algorithm SHA256 "dist\Mi3rab.exe").Hash.ToLower()
"$Hash  Mi3rab.exe" | Out-File -Encoding ascii "dist\SHA256SUMS.txt"

Write-Host ""
Write-Host "Build completed: dist\Mi3rab.exe" -ForegroundColor Green
Write-Host "SHA-256: $Hash"
