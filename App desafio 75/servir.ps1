# Servidor local simples para testar o app no computador: http://localhost:8075
param([int]$Porta = 8075)
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$tipos = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.json'='application/json; charset=utf-8'; '.svg'='image/svg+xml'; '.png'='image/png'; '.ico'='image/x-icon'; '.webmanifest'='application/manifest+json' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Porta/")
$l.Start()
Write-Host "Antecipando 2027 rodando em http://localhost:$Porta  (feche esta janela para parar)"
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $cam = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
  if ($cam -eq '') { $cam = 'index.html' }
  $arq = Join-Path $raiz $cam
  $res = $ctx.Response
  if ((Test-Path $arq -PathType Leaf) -and ([IO.Path]::GetFullPath($arq).StartsWith($raiz))) {
    $b = [IO.File]::ReadAllBytes($arq)
    $ext = [IO.Path]::GetExtension($arq).ToLower()
    $res.ContentType = if ($tipos[$ext]) { $tipos[$ext] } else { 'application/octet-stream' }
    $res.Headers.Add('Cache-Control', 'no-cache')
    $res.OutputStream.Write($b, 0, $b.Length)
  } else { $res.StatusCode = 404 }
  $res.Close()
}
