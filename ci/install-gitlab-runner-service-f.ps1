# Run in PowerShell as Administrator
Set-Location 'F:\GitLab-Runner'
if (-not (Test-Path '.\gitlab-runner.exe')) {
  Write-Error 'Missing F:\GitLab-Runner\gitlab-runner.exe'
}
$ErrorActionPreference = 'Continue'
& .\gitlab-runner.exe uninstall 2>$null
& .\gitlab-runner.exe install --working-directory 'F:\GitLab-Runner'
& .\gitlab-runner.exe start
Get-Service gitlab-runner -ErrorAction SilentlyContinue | Format-List Status, Name, DisplayName
Write-Host 'Done. Next: .\gitlab-runner.exe register'
