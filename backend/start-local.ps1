param([switch]$CheckConfig)

$ErrorActionPreference = 'Stop'
$backendRoot = $PSScriptRoot
$projectRoot = Split-Path $backendRoot -Parent
$envFile = Join-Path $backendRoot '.env'
$allowedNames = @(
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USERNAME',
    'SMTP_PASSWORD',
    'SMTP_ENCRYPTION',
    'SMTP_FROM_EMAIL',
    'SMTP_FROM_NAME',
    'FRONTEND_RESET_URL',
    'PASSWORD_RESET_RATE_KEY'
)

if (Test-Path -LiteralPath $envFile) {
    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line -notmatch '^\s*\$env:(?<name>[A-Z][A-Z0-9_]*)\s*=\s*(?<value>.+?)\s*$') {
            continue
        }

        $name = $Matches.name
        if ($allowedNames -notcontains $name) {
            continue
        }

        try {
            $value = ConvertFrom-Json -InputObject $Matches.value -ErrorAction Stop
        } catch {
            throw "Invalid quoted value for $name in backend/.env."
        }

        if ($value -isnot [string] -or [string]::IsNullOrWhiteSpace($value)) {
            throw "A non-empty string value is required for $name in backend/.env."
        }
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

if ($CheckConfig) {
    foreach ($name in $allowedNames) {
        "$name=$([bool]([Environment]::GetEnvironmentVariable($name, 'Process')))"
    }
    exit 0
}

$rateKey = [Environment]::GetEnvironmentVariable('PASSWORD_RESET_RATE_KEY', 'Process')
if ($rateKey.Length -lt 32) {
    $randomBytes = New-Object byte[] 32
    $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $randomGenerator.GetBytes($randomBytes)
    } finally {
        $randomGenerator.Dispose()
    }
    $rateKey = ([BitConverter]::ToString($randomBytes) -replace '-', '').ToLowerInvariant()
    [Environment]::SetEnvironmentVariable('PASSWORD_RESET_RATE_KEY', $rateKey, 'Process')
    Write-Warning 'PASSWORD_RESET_RATE_KEY was missing or too short; a temporary key was generated for this local server process. Configure a persistent 32-byte key for production.'
}

$php = Get-Command php -ErrorAction Stop
$router = Join-Path $backendRoot 'router.php'
& $php.Source -S localhost:8000 -t $backendRoot $router