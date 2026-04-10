# Web Health Check 端到端测试脚本（PowerShell）
# 使用方式：
# 1) 确保 API / Redis / Celery Worker 已启动
# 2) 在 step2/backend 目录执行：
#    powershell -ExecutionPolicy Bypass -File .\scripts\test_web_health_check.ps1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "[1/5] 健康检查..."
Invoke-RestMethod -Method GET -Uri "http://127.0.0.1:8000/health" | ConvertTo-Json -Depth 10

Write-Host "[2/5] 创建 web_health_check 任务..."
$body = @{
  task_type = "web_health_check"
  title = "example首页巡检成功用例"
  input_payload = @{
    base_url = "https://example.com"
    pages = @("/")
    required_selectors = @{
      "/" = @("h1")
    }
    timeout_ms = 15000
    verify_ssl = $false
  }
} | ConvertTo-Json -Depth 10

$create = Invoke-RestMethod -Method POST `
  -Uri "http://127.0.0.1:8000/api/tasks" `
  -Headers @{ "Content-Type" = "application/json"; "X-Request-Id" = "req_demo_001" } `
  -Body $body

$create | ConvertTo-Json -Depth 10
$taskId = $create.data.task_id
Write-Host "task_id = $taskId"

Write-Host "[3/5] 启动 run..."
$run = Invoke-RestMethod -Method POST `
  -Uri ("http://127.0.0.1:8000/api/tasks/{0}/run" -f $taskId)

$run | ConvertTo-Json -Depth 10
$runId = $run.data.run_id
Write-Host "run_id = $runId"

Write-Host "[4/5] 等待异步执行..."
Start-Sleep -Seconds 5

Write-Host "[5/5] 查询结果 / 轨迹 / 工具日志..."
Invoke-RestMethod -Method GET `
  -Uri ("http://127.0.0.1:8000/api/runs/{0}" -f $runId) | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method GET `
  -Uri ("http://127.0.0.1:8000/api/runs/{0}/trace" -f $runId) | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method GET `
  -Uri ("http://127.0.0.1:8000/api/runs/{0}/tool-calls" -f $runId) | ConvertTo-Json -Depth 10
