# 后续待办（非 Web Health Check / Scenario Regression 专项）

## 一、功能扩展（按优先级）

- [ ] 完成 `Form Automation` 真实执行逻辑（替换 mock）
- [ ] 完成 `Web Extraction` 真实执行逻辑（替换 mock）
- [ ] 完成 `CI/CD Inspection` 真实执行逻辑（替换 mock）
- [ ] 完成 `Release Gate` 真实执行逻辑（替换 mock）

## 二、接口与数据模型优化

- [ ] 统一 run 结果字段，规范 `success/failed/degraded` 判定策略
- [ ] 增加接口 `response_examples`（OpenAPI 示例）
- [ ] 增加统一分页策略到更多列表接口
- [ ] 为 `Scenario Regression` 增加更清晰的步骤结果字段说明

## 三、稳定性与可维护性

- [ ] 完善 Repository / Service 的 Protocol 实际落地注入（依赖倒置）
- [ ] 增加配置校验（启动时检查 MySQL/Redis/Playwright 关键配置）
- [ ] 增加任务超时、重试、幂等保护策略
- [ ] 增加结构化日志（包含 request_id / run_id / trace_id）

## 四、WebSocket 能力增强

- [ ] 推送 `run.step`、`run.tool_call`、`run.failed`、`run.succeeded` 全事件流
- [ ] 增加前端重连与断线恢复建议（携带 run_id 增量拉取）

## 五、测试与质量保障

- [ ] 补充 service 层单测（task/run/trace）
- [ ] 补充 repository 层测试（查询与分页）
- [ ] 补充 Form Automation / Web Extraction / CI/CD / Release Gate 的测试
- [ ] 增加最小集成测试（API + DB + Redis + Celery + Playwright）

## 六、工程化与部署

- [ ] 增加 Alembic 迁移脚本并替换 `create_all`
- [ ] 增加 Docker Compose（mysql + redis + backend + worker）
- [ ] 完善 README：Windows / Linux 启动差异（Celery `--pool=solo`，Playwright 浏览器安装）
- [ ] 增加 `.env` 安全检查与敏感信息提交防护

## 七、前端联调配套

- [ ] 提供前端任务提交示例（6 类任务模板）
- [ ] 提供前端运行详情页字段对照（run/trace/tool-calls/result）
- [ ] 增加错误码对照文档（前端 toast 与重试策略）
