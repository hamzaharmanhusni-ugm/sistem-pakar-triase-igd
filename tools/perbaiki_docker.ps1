# Perbaiki Docker Desktop yang gagal menyala karena berkas socket rusak ("The file cannot be accessed by the system").
# Penyebab: Docker tertutup tidak wajar (shutdown, sleep, crash) sehingga socket unix lama tertinggal dan tidak dapat dihapus Windows.
# Skrip ini TIDAK menghapus apa pun: folder berisi socket rusak hanya diganti nama (*.rusak-<waktu>), Docker membuat folder baru.
# Pemakaian (PowerShell biasa, tidak perlu administrator):  powershell -ExecutionPolicy Bypass -File tools\perbaiki_docker.ps1

Get-Process | Where-Object { $_.ProcessName -match '^(Docker Desktop|com\.docker\..*|docker-.*)$' } |
    ForEach-Object { try { Stop-Process -Id $_.Id -Force -Confirm:$false -ErrorAction Stop } catch {} }
Start-Sleep -Seconds 2

$roots = @("$env:LOCALAPPDATA\Docker\run", "$env:LOCALAPPDATA\docker-secrets-engine", "$env:USERPROFILE\.docker\run") | Where-Object { Test-Path $_ }
$bad = foreach ($r in $roots) {
    Get-ChildItem -LiteralPath $r -Recurse -Force -ErrorAction SilentlyContinue -Attributes ReparsePoint |
        Where-Object { -not $_.PSIsContainer } |
        Where-Object { try { [System.IO.File]::OpenRead($_.FullName).Dispose(); $false } catch { $_.Exception.Message -match 'cannot be accessed' } }
}
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$bad | ForEach-Object { $_.DirectoryName } | Sort-Object -Unique | ForEach-Object {
    Rename-Item -LiteralPath $_ -NewName ((Split-Path $_ -Leaf) + ".rusak-$stamp")
    Write-Host "Disingkirkan: $_"
}
if (-not $bad) { Write-Host 'Tidak ada socket rusak.' }

Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
Write-Host 'Menunggu Docker siap...'
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 5
    docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host 'Docker siap. Menyalakan GraphDB...'; docker start graphdb11; exit 0 }
}
Write-Host 'Docker belum siap setelah 200 detik. Lihat log di %LOCALAPPDATA%\Docker\log\host\com.docker.backend.exe.log'
exit 1
