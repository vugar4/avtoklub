$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repoRoot

function Invoke-Checked([string]$label, [scriptblock]$command) {
    Write-Host "Checking $label..."
    & $command
    if ($LASTEXITCODE -ne 0) { throw "$label failed (exit $LASTEXITCODE)." }
}

if ((git branch --show-current).Trim() -ne 'main') {
    throw 'Publish must run from the main branch.'
}
if ((git status --porcelain).Length -ne 0) {
    throw 'Working tree is not clean. Review and commit intended changes first.'
}
$remote = (git remote get-url origin).Trim()
if ($remote -notmatch '(^|[/:])globalsefcaremmc-bit/avtoklub(\.git)?$') {
    throw 'Origin is not the expected Avtoklub GitHub repository.'
}

Invoke-Checked 'GitHub main fetch' { git fetch origin main }
$headSha = (git rev-parse HEAD).Trim()
$remoteMainSha = (git rev-parse FETCH_HEAD).Trim()
if ($headSha -ne $remoteMainSha) {
    throw 'Local HEAD and GitHub main differ. Sync main before publishing.'
}

$productionRef = git ls-remote --heads origin production
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect GitHub production branch.' }
if ($productionRef) {
    Invoke-Checked 'GitHub production fetch' { git fetch origin production }
    $productionSha = (git rev-parse FETCH_HEAD).Trim()
    if ($productionSha -eq $headSha) {
        Write-Host 'Production already points to this commit.'
        exit 0
    }
    & git merge-base --is-ancestor $productionSha $headSha
    if ($LASTEXITCODE -ne 0) {
        throw 'Production is not an ancestor of main. Resolve branch history before publishing.'
    }
}

Invoke-Checked 'ESLint' { npm.cmd run lint }
Invoke-Checked 'TypeScript' { npm.cmd run typecheck }
Invoke-Checked 'production build' { npm.cmd run build }
if ((git rev-parse HEAD).Trim() -ne $headSha -or (git status --porcelain).Length -ne 0) {
    throw 'Repository changed during validation. Review and run publish again.'
}

Invoke-Checked 'production branch push' { git push origin "${headSha}:refs/heads/production" }
Write-Host "Pushed $headSha to production. Check Hostinger deployment status and the live site."
