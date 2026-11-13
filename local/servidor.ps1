# Gildem's Craft - servidor local
# Sirve la app en http://localhost:8765/ y hace de puente hacia la API de Albion Online Data
# (el navegador bloquea las llamadas directas cuando el archivo se abre con doble clic).
# Cierra esta ventana para detenerlo.

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$dir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$html = Join-Path $dir 'Gildems_Craft.html'
$port = 8765
if ($env:GC_PORT) { $port = [int]$env:GC_PORT }
$upstream = @{
  'america' = 'https://west.albion-online-data.com'
  'europa'  = 'https://europe.albion-online-data.com'
  'asia'    = 'https://east.albion-online-data.com'
}
if ($env:GC_UPSTREAM) { foreach ($k in @($upstream.Keys)) { $upstream[$k] = $env:GC_UPSTREAM } }

if (-not (Test-Path $html)) {
  Write-Host "No encuentro Gildems_Craft.html junto a este script: $html"
  exit 1
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
  $listener.Start()
} catch {
  Write-Host "El puerto $port ya esta en uso (puede que la app ya este abierta). Abriendo el navegador..."
  if (-not $env:GC_NOBROWSER) { Start-Process "http://localhost:$port/" }
  exit 0
}

Write-Host ""
Write-Host "  Gildem's Craft funcionando en http://localhost:$port/"
Write-Host "  Deja esta ventana abierta mientras usas la app. Cierrala para detenerla."
Write-Host ""
if (-not $env:GC_NOBROWSER) { Start-Process "http://localhost:$port/" }

function Send-Bytes($res, [int]$code, [string]$type, [byte[]]$bytes) {
  $res.StatusCode = $code
  $res.ContentType = $type
  $res.Headers.Add('Cache-Control', 'no-store')
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $path = $req.Url.AbsolutePath
    if ($path -eq '/' -or $path -eq '/index.html') {
      Send-Bytes $res 200 'text/html; charset=utf-8' ([IO.File]::ReadAllBytes($html))
    }
    elseif ($path -match '^/proxy/(america|europa|asia)(/api/.*)$') {
      $url = $upstream[$Matches[1]] + $Matches[2] + $req.Url.Query
      $wr = [Net.HttpWebRequest]::Create($url)
      $wr.AutomaticDecompression = [Net.DecompressionMethods]::GZip -bor [Net.DecompressionMethods]::Deflate
      $wr.UserAgent = 'GildemsCraft/1.1'
      $wr.Timeout = 45000
      $resp = $null
      try { $resp = $wr.GetResponse() }
      catch [Net.WebException] {
        $resp = $_.Exception.Response
        if ($null -eq $resp) { throw }
      }
      $ms = New-Object IO.MemoryStream
      $stream = $resp.GetResponseStream()
      $stream.CopyTo($ms)
      $stream.Close()
      $code = [int]$resp.StatusCode
      $resp.Close()
      Send-Bytes $res $code 'application/json; charset=utf-8' ($ms.ToArray())
      Write-Host ("  {0} {1}" -f $code, ($Matches[2] -replace '^/api/v2/stats/', '').Substring(0, [Math]::Min(70, ($Matches[2] -replace '^/api/v2/stats/', '').Length)))
    }
    else {
      Send-Bytes $res 404 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('No encontrado'))
    }
  }
  catch {
    $msg = "Error del puente: " + $_.Exception.Message
    Write-Host "  $msg"
    try { Send-Bytes $res 502 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes($msg)) } catch {}
  }
  finally {
    try { $res.Close() } catch {}
  }
}
