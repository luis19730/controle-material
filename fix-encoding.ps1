# fix-encoding.ps1 - Byte-level mojibake fix
# Replaces corrupted UTF-8 byte sequences with correct ones
# Uso: powershell -ExecutionPolicy Bypass -File fix-encoding.ps1

$basePath = $PSScriptRoot
$utf8 = [System.Text.Encoding]::UTF8

# Pattern definitions as byte arrays
# Format: @(from_bytes...) -> @(to_bytes...)
# Each pattern is: the mojibake bytes -> correct UTF-8 bytes

$patterns = @(
    # "ao" triple-encoded: C3 83 C6 92 C3 82 C2 A3 6F -> C3 A3 6F
    @{
        From = [byte[]]@(0xC3, 0x83, 0xC6, 0x92, 0xC3, 0x82, 0xC2, 0xA3, 0x6F)
        To   = [byte[]]@(0xC3, 0xA3, 0x6F)
    },
    # "o" triple-encoded: C3 83 C6 92 C3 82 C2 B3 -> C3 B3
    @{
        From = [byte[]]@(0xC3, 0x83, 0xC6, 0x92, 0xC3, 0x82, 0xC2, 0xB3)
        To   = [byte[]]@(0xC3, 0xB3)
    },
    # Triple-encoded ordinals from data.js:
    # "oo" triple: C3 83 E2 80 9A C2 82 C2 BA -> C2 BA  (degree sign)
    @{
        From = [byte[]]@(0xC3, 0x83, 0xE2, 0x80, 0x9A, 0xC2, 0x82, 0xC2, 0xBA)
        To   = [byte[]]@(0xC2, 0xBA)
    },
    # "aa" triple: C3 83 E2 80 9A C2 82 C2 AA -> C2 AA  (feminine ordinal)
    @{
        From = [byte[]]@(0xC3, 0x83, 0xE2, 0x80, 0x9A, 0xC2, 0x82, 0xC2, 0xAA)
        To   = [byte[]]@(0xC2, 0xAA)
    },
    # "O" triple: C3 83 C6 92 C3 A2 E2 82 AC -> C3 93 (for Relatorio in relatorio)
    @{
        From = [byte[]]@(0xC3, 0x83, 0xC6, 0x92, 0xC3, 0xA2, 0xE2, 0x82, 0xAC)
        To   = [byte[]]@(0xC3, 0x93)
    },
    # "C" triple: C3 83 C6 92 C3 A2 E2 82 AC C2 A1 -> C3 87 (for Organizacao)
    @{
        From = [byte[]]@(0xC3, 0x83, 0xC6, 0x92, 0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xC2, 0xA1)
        To   = [byte[]]@(0xC3, 0x87)
    },
    # "C" triple alt: C3 83 C6 92 C3 86 E2 80 99 -> C3 87
    @{
        From = [byte[]]@(0xC3, 0x83, 0xC6, 0x92, 0xC3, 0x86, 0xE2, 0x80, 0x99)
        To   = [byte[]]@(0xC3, 0x87)
    }
)

$files = @("data.js","index.html","painel.html","relatorio.html","imprimir.html")
$fixedCount = 0

foreach ($fname in $files) {
    $f = Join-Path $basePath $fname
    if (-not (Test-Path $f)) { continue }
    
    $bytes = [System.IO.File]::ReadAllBytes($f)
    $original = $bytes.Clone()
    
    foreach ($pat in $patterns) {
        $from = $pat.From
        $to = $pat.To
        $searchIdx = 0
        
        while ($searchIdx -le $bytes.Length - $from.Length) {
            $match = $true
            for ($j = 0; $j -lt $from.Length; $j++) {
                if ($bytes[$searchIdx + $j] -ne $from[$j]) {
                    $match = $false
                    break
                }
            }
            if ($match) {
                $newBytes = New-Object byte[] ($bytes.Length - $from.Length + $to.Length)
                [System.Buffer]::BlockCopy($bytes, 0, $newBytes, 0, $searchIdx)
                [System.Buffer]::BlockCopy($to, 0, $newBytes, $searchIdx, $to.Length)
                [System.Buffer]::BlockCopy($bytes, $searchIdx + $from.Length, $newBytes, $searchIdx + $to.Length, $bytes.Length - $searchIdx - $from.Length)
                $bytes = $newBytes
                $searchIdx += $to.Length
            } else {
                $searchIdx++
            }
        }
    }
    
    $changed = $false
    if ($bytes.Length -ne $original.Length) {
        $changed = $true
    } else {
        for ($i = 0; $i -lt $bytes.Length; $i++) {
            if ($bytes[$i] -ne $original[$i]) { $changed = $true; break }
        }
    }
    
    if ($changed) {
        [System.IO.File]::WriteAllBytes($f, $bytes)
        Write-Host "FIXED: $fname" -ForegroundColor Green
        $fixedCount++
    } else {
        Write-Host "OK: $fname (no changes)" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "Done. Fixed $fixedCount file(s)." -ForegroundColor Green
