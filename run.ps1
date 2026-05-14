$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

& "$scriptDir\.venv\Scripts\Activate.ps1"
uvicorn backend.app:app --reload --port 8000
