# MyClaw（窄域 OpenClaw）框架草案

## 1. 目标定义

MyClaw 定位为“窄域自治 Agent”：
- 在**限定场景**内（如课程项目管理、网页状态检查、测试执行）自主完成任务；
- 不追求通用全能助手，而追求可控、可演示、可评估。

> 核心思路：Agent 负责“规划与决策”，Playwright 负责“浏览器执行动作”。

---

## 2. 总体架构（分层）

```text
┌──────────────────────────────────────────────┐
│                Frontend (Web)               │
│ 任务输入 / 实时状态 / 执行日志 / 结果可视化     │
└──────────────────────────────────────────────┘
                    │ REST/WebSocket
┌──────────────────────────────────────────────┐
│            API & Orchestrator Layer          │
│ FastAPI/NestJS: 任务管理、状态机、调度、鉴权   │
└──────────────────────────────────────────────┘
                    │
┌──────────────────────────────────────────────┐
│                Agent Core Layer              │
│ Plan-and-Execute + ReAct + Reflexion         │
│ (目标分解 -> 工具调用 -> 观察 -> 反思重规划)   │
└──────────────────────────────────────────────┘
                    │
┌──────────────────────────────────────────────┐
│                Tool Adapter Layer            │
│ Playwright Adapter / Repo Adapter / Test Adapter │
└──────────────────────────────────────────────┘
                    │
┌──────────────────────────────────────────────┐
│              Execution & Data Layer          │
│ Redis队列(可选) / PostgreSQL / Trace日志      │
└──────────────────────────────────────────────┘
```

---

## 3. 关键模块说明

### 3.1 Frontend
- 任务提交（例如“检查某页面按钮是否可点击并截图”）
- 执行过程可视化（阶段流转 + 工具调用）
- 结果展示（结论、证据截图、失败原因）

### 3.2 API & Orchestrator
- 提供任务 CRUD、运行控制、日志查询接口
- 管理任务状态：`pending -> running -> success/failed`
- 协调 Agent Core 与工具层

### 3.3 Agent Core
- **Plan-and-Execute**：先做高层计划
- **ReAct**：每一步中思考并调用工具
- **Reflexion**：失败后反思并调整策略

### 3.4 Tool Adapter
- **Playwright Adapter（核心）**
  - 打开页面、点击、输入、提取文本、截图
  - 捕获超时、元素不存在、导航失败等异常
- 可扩展：Repo/Test/API 调用工具

### 3.5 Execution & Data
- 异步执行长任务（可选）
- 存储任务运行轨迹（trace）与工具调用日志
- 支撑后续评估平台对接

---

## 4. Playwright 在 MyClaw 中的位置

Playwright 在框架中是“执行器”，不是“智能体”：
- Agent 决定做什么（策略层）
- Playwright 执行怎么做（动作层）

即：
- `MyClaw = Agent Brain + Tool Hands`
- `Playwright = Tool Hands`

---

## 5. 端到端执行流程

1. 用户输入目标任务；
2. Agent 生成任务计划；
3. Agent 调用 Playwright Adapter 执行网页动作；
4. 收集观察结果（文本、状态、截图、错误）；
5. 若失败，触发 Reflexion 重规划并重试；
6. 输出最终结果与可追溯日志。

---

## 6. 网页操作可落地方向（实用版）

建议围绕“网页自动化 + Agent 决策”设计以下 6 个方向：

1. **网页巡检与可用性检查（Web Health Check）**
   - 自动检查目标页面是否可访问、关键元素是否存在；
   - 捕获白屏、超时、关键按钮缺失等问题。

2. **业务流程回归验证（Scenario Regression）**
   - 自动执行核心流程（如登录->查询->提交）；
   - 校验关键步骤结果是否符合预期。

3. **表单自动填写与校验（Form Automation）**
   - 自动填表、上传、提交、校验提交回执；
   - 对字段格式错误进行自动修正重试。

4. **网页信息采集与结构化（Web Extraction）**
   - 抓取列表/详情信息并输出 JSON/CSV；
   - 做去重、缺失标注与数据质量统计。

5. **CI/CD 结果网页巡检（DevOps Web Ops）**
   - 自动打开 GitLab CI/CD 页面，定位失败 job 与错误摘要；
   - 输出优先修复建议与相关链接。

6. **发布前冒烟检查与门禁（Release Gate）**
   - 自动执行固定冒烟集并给出“可发布/不可发布”结论；
   - 失败时附带回滚与修复建议。

---

## 7. 各方向输入/输出字段模板

为便于后端接口与评估平台对齐，建议统一字段结构。

### 7.1 网页巡检与可用性检查

**输入字段（Input）**
- `task_type`: `web_health_check`
- `base_url`: 目标站点
- `pages`: 需检查的页面列表
- `required_selectors`: 每个页面的关键元素选择器
- `timeout_ms`: 超时阈值

**输出字段（Output）**
- `task_status`: success/failed
- `page_results`: 每页检查结果
- `missing_selectors`: 缺失元素列表
- `screenshots`: 证据截图路径
- `summary`: 失败原因摘要

### 7.2 业务流程回归验证

**输入字段（Input）**
- `task_type`: `scenario_regression`
- `scenario_name`: 场景名称
- `steps`: 流程步骤定义
- `assertions`: 每步断言条件
- `retry_policy`: 重试策略

**输出字段（Output）**
- `task_status`: success/failed
- `step_pass_rate`: 步骤通过率
- `failed_steps`: 失败步骤明细
- `evidence`: 截图/页面文本/日志
- `fix_suggestion`: 修复建议

### 7.3 表单自动填写与校验

**输入字段（Input）**
- `task_type`: `form_automation`
- `form_url`: 表单页面
- `field_mapping`: 字段与值映射
- `validation_rules`: 字段校验规则
- `submit_selector`: 提交按钮选择器

**输出字段（Output）**
- `task_status`: success/failed
- `submitted_data_snapshot`: 提交快照
- `validation_errors`: 校验失败字段
- `receipt_info`: 回执信息（编号/状态）
- `retry_count`: 重试次数

### 7.4 网页信息采集与结构化

**输入字段（Input）**
- `task_type`: `web_extraction`
- `seed_urls`: 起始页面列表
- `extract_schema`: 目标字段定义
- `pagination_rule`: 翻页规则
- `max_pages`: 最大页数

**输出字段（Output）**
- `task_status`: success/failed
- `records`: 结构化记录
- `record_count`: 记录数
- `duplicate_count`: 重复数
- `quality_report`: 缺失率/异常值统计

### 7.5 CI/CD 结果网页巡检

**输入字段（Input）**
- `task_type`: `cicd_inspection`
- `platform`: `gitlab`
- `project_url`: 项目地址
- `pipeline_id` 或 `branch`: 目标流水线
- `focus_jobs`: 关注 job 列表

**输出字段（Output）**
- `task_status`: success/failed
- `pipeline_status`: 流水线状态
- `failed_jobs`: 失败 job 列表
- `error_digest`: 错误摘要
- `priority_fix_list`: 优先修复建议

### 7.6 发布前冒烟检查与门禁

**输入字段（Input）**
- `task_type`: `release_gate`
- `release_version`: 版本号
- `smoke_suite`: 冒烟检查集
- `pass_threshold`: 通过阈值
- `rollback_policy`: 回滚策略

**输出字段（Output）**
- `task_status`: success/failed
- `gate_decision`: allow/deny
- `suite_pass_rate`: 冒烟通过率
- `critical_failures`: 阻断项列表
- `rollback_advice`: 回滚建议

---

## 8. 评估指标（便于任务二接入）

显式指标：
- 任务成功率
- 平均执行耗时
- 工具调用成功率
- 重试次数

过程指标：
- 规划步骤合理性
- 失败后的修正有效性
- 最终结果与目标一致性

---

## 8. 6周落地建议（简版）

- 第1周：框架搭建 + 数据结构定义
- 第2周：Agent 主链路（Plan/ReAct）
- 第3周：Playwright Adapter 接入
- 第4周：Reflexion + 异常恢复
- 第5周：可视化与日志完善
- 第6周：联调、评估、录制演示

---

## 9. 结论

MyClaw 采用“窄域自治 + Playwright 执行器”模式：
- 能体现 Agent 的自主规划与自我修正能力；
- 同时控制复杂度，适合课程项目 6 周交付；
- 可平滑对接任务二评估平台。