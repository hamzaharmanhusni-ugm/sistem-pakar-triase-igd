# Render setiap slide PPTX ke PNG memakai PowerPoint (untuk QA visual).
# Pemakaian: powershell -File render.ps1 "<path pptx>" "<folder keluaran>"
param([string]$Pptx, [string]$Out)
New-Item -ItemType Directory -Force $Out | Out-Null
Get-ChildItem $Out -Filter *.png | Remove-Item -Force
$pp = New-Object -ComObject PowerPoint.Application
$deck = $pp.Presentations.Open((Resolve-Path $Pptx).Path, $true, $false, $false)
$i = 0
foreach ($s in $deck.Slides) { $i++; $s.Export((Join-Path (Resolve-Path $Out).Path ("slide-{0:D2}.png" -f $i)), "PNG", 1600, 900) }
$deck.Close(); $pp.Quit()
"$i slide dirender ke $Out"
