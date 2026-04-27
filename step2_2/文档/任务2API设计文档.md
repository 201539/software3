# 任务2 API 设计文档

## 1. 文档概述

### 1.1 文档名称
AI Coding Agent 评估平台 API 设计文档

### 1.2 技术选型
- **前端框架**：React + TypeScript + Ant Design
- **后端框架**：FastAPI
- **异步任务队列**：Celery
- **缓存与消息中间件**：Redis
- **主数据库**：MySQL 8.x
- **ORM 框架**：SQLAlchemy
- **实时通信**：WebSocket
- **图表展示**：ECharts
- **评估能力支持**：Ragas（用于部分自动化评估指标）

### 1.3 设计目标
本文档用于定义任务 2 评估平台的核心接口规范，为前端页面、后端服务、任务调度、评估执行和结果分析提供统一的 API 约定。平台重点服务于 AI Coding Agent 的项目生成、代码修改、命令执行、快照回滚与结果分析场景，同时保留对其他 Agent 应用的通用评测能力。

### 1.4 设计原则
- 统一资源风格，采用 RESTful 风格设计
- 任务创建、执行、查询、分析分层处理
- 支持异步评测与状态轮询/推送
- 支持过程数据、指标数据与报告数据分离存储
- 支持扩展评估方法与自定义指标
- 支持 AI Coding Agent 相关场景的数据表达与结果展示

---

## 2. 总体约定

### 2.1 基础信息
- Base URL：`/api/v1`
- 数据格式：`application/json`
- 字符编码：`UTF-8`
- 时间格式：`ISO 8601`

### 2.2 通用响应格式
```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "trace_id": "eval_20260417_0001"
}
```

### 2.3 通用分页格式
```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 100
}
```

### 2.4 通用状态枚举
#### 任务状态
- `draft`：草稿
- `pending`：待执行
- `running`：执行中
- `succeeded`：成功
- `failed`：失败
- `cancelled`：已取消
- `archived`：已归档

#### 运行状态
- `queued`：排队中
- `running`：运行中
- `paused`：已暂停
- `completed`：已完成
- `failed`：失败
- `cancelled`：已取消

#### 数据集样本类型
- `project_scaffold`：项目骨架生成
- `code_edit`：代码修改
- `bug_fix`：错误修复
- `command_execution`：命令执行
- `snapshot_restore`：快照/回滚
- `multi_turn_revision`：多轮修正

---

## 3. 核心资源模型

### 3.1 评测任务 EvaluationTask
```json
{
  "id": 1,
  "task_code": "task_001",
  "name": "AI Coding Agent 版本评测",
  "description": "评估项目生成、代码修改与命令执行能力",
  "agent_id": "agent_myclaw_v1",
  "dataset_id": 1,
  "evaluation_method_config": ["method_result", "method_process"],
  "metric_config": {
    "explicit_metrics": ["task_success_rate", "command_success_rate", "build_success_rate"],
    "fuzzy_metrics": ["code_edit_quality", "interaction_quality"]
  },
  "run_config": {
    "timeout_ms": 30000,
    "concurrency": 2,
    "retry_times": 1
  },
  "status": "draft",
  "created_at": "2026-04-17T10:00:00Z",
  "updated_at": "2026-04-17T10:00:00Z"
}
```

### 3.2 评测运行 EvaluationRun
```json
{
  "id": 1,
  "run_code": "run_001",
  "task_id": 1,
  "status": "running",
  "progress": 30.0,
  "started_at": "2026-04-17T10:05:00Z",
  "ended_at": null,
  "summary": "当前执行 3/10",
  "trace_id": "eval_20260417_0001",
  "error_message": null,
  "created_at": "2026-04-17T10:05:00Z",
  "updated_at": "2026-04-17T10:05:00Z"
}
```

### 3.3 数据集 Dataset
```json
{
  "id": 1,
  "dataset_code": "dataset_001",
  "name": "AI Coding Agent 基础评测集",
  "description": "覆盖项目骨架生成、代码修改、错误修复和命令执行",
  "source_type": "manual",
  "sample_count": 20,
  "version": "v1",
  "status": "draft",
  "created_by": 1,
  "created_at": "2026-04-17T10:00:00Z",
  "updated_at": "2026-04-17T10:00:00Z"
}
```

### 3.4 数据集样本 DatasetSample
```json
{
  "id": 1,
  "dataset_id": 1,
  "sample_code": "sample_001",
  "sample_type": "code_edit",
  "input_payload": {
    "task": "为首页增加一个提交按钮",
    "workspace_hint": ["src/pages/index.tsx"]
  },
  "expected_output": {
    "files_changed": ["src/pages/index.tsx"],
    "build_should_pass": true
  },
  "reference_context": {
    "project_type": "Vite + React"
  },
  "ground_truth": {
    "label": "correct"
  },
  "metadata": {
    "difficulty": "easy"
  },
  "created_at": "2026-04-17T10:00:00Z",
  "updated_at": "2026-04-17T10:00:00Z"
}
```

### 3.5 评估方法 EvaluationMethod
```json
{
  "id": 1,
  "method_code": "method_result",
  "name": "面向结果评估",
  "category": "result",
  "description": "只关注输入输出与最终结果",
  "config_schema": {},
  "enabled": true,
  "created_at": "2026-04-17T10:00:00Z",
  "updated_at": "2026-04-17T10:00:00Z"
}
```

### 3.6 指标定义 MetricDefinition
```json
{
  "id": 1,
  "metric_code": "task_success_rate",
  "name": "任务成功率",
  "metric_type": "explicit",
  "dimension": "effect",
  "description": "评估任务是否成功完成",
  "calc_mode": "rule",
  "config_schema": {},
  "enabled": true,
  "created_at": "2026-04-17T10:00:00Z",
  "updated_at": "2026-04-17T10:00:00Z"
}
```

### 3.7 指标结果 MetricResult
```json
{
  "id": 1,
  "run_id": 1,
  "sample_id": null,
  "metric_id": 1,
  "metric_code": "task_success_rate",
  "metric_name": "任务成功率",
  "metric_type": "explicit",
  "metric_value": 0.86,
  "metric_text": null,
  "metric_detail": {
    "unit": "%",
    "description": "任务最终完成比例"
  },
  "created_at": "2026-04-17T10:10:00Z"
}
```

### 3.8 过程轨迹 TraceRecord
```json
{
  "id": 1,
  "run_id": 1,
  "sample_id": 1,
  "step_index": 3,
  "phase": "act",
  "decision": "调用文件写入工具修改首页按钮",
  "observation": "文件写入成功",
  "state_snapshot": {
    "current_sample_id": 1,
    "current_status": "running"
  },
  "tool_calls": [
    {
      "tool_name": "write_file",
      "success": true,
      "duration_ms": 1200
    }
  ],
  "created_at": "2026-04-17T10:06:12Z"
}
```

### 3.9 工具调用日志 ToolCallLog
```json
{
  "id": 1,
  "run_id": 1,
  "sample_id": 1,
  "tool_name": "write_file",
  "input_payload": {
    "path": "src/pages/index.tsx"
  },
  "output_payload": {
    "success": true
  },
  "success": true,
  "error_type": null,
  "duration_ms": 1200,
  "created_at": "2026-04-17T10:06:12Z"
}
```

### 3.10 评测报告 EvaluationReport
```json
{
  "id": 1,
  "run_id": 1,
  "report_title": "AI Coding Agent 版本评测报告",
  "report_summary": "本次评测整体表现良好，命令执行成功率较高",
  "report_path": "/reports/run_001.pdf",
  "report_format": "pdf",
  "created_at": "2026-04-17T10:10:00Z",
  "updated_at": "2026-04-17T10:10:00Z"
}
```

---

## 4. 接口设计

## 4.1 评测任务管理

### 4.1.1 创建评测任务
- **Method**：`POST`
- **Path**：`/api/v1/evaluation-tasks`

**Request**
```json
{
  "name": "AI Coding Agent 版本评测",
  "description": "评估项目生成、代码修改与命令执行能力",
  "agent_id": "agent_myclaw_v1",
  "dataset_id": 1,
  "evaluation_method_config": ["method_result", "method_process"],
  "metric_config": {
    "explicit_metrics": ["task_success_rate", "command_success_rate", "build_success_rate"],
    "fuzzy_metrics": ["code_edit_quality", "interaction_quality"]
  },
  "run_config": {
    "timeout_ms": 30000,
    "concurrency": 2,
    "retry_times": 1
  }
}
```

**Response**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "task_code": "task_001"
  },
  "trace_id": "eval_20260417_0001"
}
```

### 4.1.2 查询评测任务列表
- **Method**：`GET`
- **Path**：`/api/v1/evaluation-tasks`
- **Query**：`name`、`status`、`page`、`page_size`

### 4.1.2.1 评测任务对象
```json
{
  "id": 1,
  "task_code": "task_001",
  "name": "AI Coding Agent 版本评测",
  "description": "评估项目生成、代码修改与命令执行能力",
  "agent_id": "agent_myclaw_v1",
  "dataset_id": 1,
  "status": "draft",
  "metric_config": {
    "explicit_metrics": ["task_success_rate", "command_success_rate", "build_success_rate"],
    "fuzzy_metrics": ["code_edit_quality", "interaction_quality"]
  },
  "evaluation_method_config": ["method_result", "method_process"],
  "run_config": {
    "timeout_ms": 30000,
    "concurrency": 2,
    "retry_times": 1
  },
  "created_by": 1,
  "updated_by": 1,
  "created_at": "2026-04-17T10:00:00Z",
  "updated_at": "2026-04-17T10:00:00Z",
  "deleted_at": null
}
```

### 4.1.3 查询评测任务详情
- **Method**：`GET`
- **Path**：`/api/v1/evaluation-tasks/{task_id}`

### 4.1.4 修改评测任务
- **Method**：`PUT`
- **Path**：`/api/v1/evaluation-tasks/{task_id}`

### 4.1.5 删除评测任务
- **Method**：`DELETE`
- **Path**：`/api/v1/evaluation-tasks/{task_id}`

---

## 4.2 评测执行管理

### 4.2.1 启动评测任务
- **Method**：`POST`
- **Path**：`/api/v1/evaluation-tasks/{task_id}/runs`

**Request**
```json
{
  "dataset_version": "v1",
  "run_mode": "async"
}
```

**Response**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "run_id": 1,
    "run_code": "run_001",
    "status": "queued"
  },
  "trace_id": "eval_20260417_0001"
}
```

### 4.2.2 查询运行列表
- **Method**：`GET`
- **Path**：`/api/v1/evaluation-runs`
- **Query**：`task_id`、`status`、`page`、`page_size`

### 4.2.3 查询运行详情
- **Method**：`GET`
- **Path**：`/api/v1/evaluation-runs/{run_id}`

### 4.2.4 取消运行
- **Method**：`POST`
- **Path**：`/api/v1/evaluation-runs/{run_id}/cancel`

### 4.2.5 重试运行
- **Method**：`POST`
- **Path**：`/api/v1/evaluation-runs/{run_id}/retry`

---

## 4.3 数据集管理

### 4.3.1 创建数据集
- **Method**：`POST`
- **Path**：`/api/v1/datasets`

**Request**
```json
{
  "dataset_code": "dataset_001",
  "name": "AI Coding Agent 基础评测集",
  "description": "覆盖项目骨架生成、代码修改、错误修复和命令执行",
  "source_type": "manual",
  "version": "v1",
  "status": "draft"
}
```

### 4.3.2 查询数据集列表
- **Method**：`GET`
- **Path**：`/api/v1/datasets`

### 4.3.3 查询数据集详情
- **Method**：`GET`
- **Path**：`/api/v1/datasets/{dataset_id}`

### 4.3.4 上传数据集样本
- **Method**：`POST`
- **Path**：`/api/v1/datasets/{dataset_id}/samples`

**Request**
```json
{
  "sample_code": "sample_001",
  "sample_type": "code_edit",
  "input_payload": {
    "task": "为首页增加一个提交按钮",
    "workspace_hint": ["src/pages/index.tsx"]
  },
  "expected_output": {
    "files_changed": ["src/pages/index.tsx"],
    "build_should_pass": true
  },
  "reference_context": {
    "project_type": "Vite + React"
  },
  "ground_truth": {
    "label": "correct"
  },
  "metadata": {
    "difficulty": "easy"
  }
}
```

### 4.3.5 删除数据集
- **Method**：`DELETE`
- **Path**：`/api/v1/datasets/{dataset_id}`

---

## 4.4 评估方法与指标

### 4.4.1 获取评估方法列表
- **Method**：`GET`
- **Path**：`/api/v1/evaluation-methods`

### 4.4.1.1 评估方法对象
```json
{
  "method_code": "method_result",
  "name": "面向结果评估",
  "category": "result",
  "description": "仅关注输入输出与最终结果",
  "config_schema": {},
  "enabled": true
}
```

### 4.4.2 获取指标列表
- **Method**：`GET`
- **Path**：`/api/v1/metrics`

### 4.4.2.1 指标对象
```json
{
  "metric_code": "task_success_rate",
  "name": "任务成功率",
  "metric_type": "explicit",
  "dimension": "effect",
  "description": "评估任务是否成功完成",
  "calc_mode": "rule",
  "config_schema": {},
  "enabled": true
}
```

### 4.4.3 创建自定义指标
- **Method**：`POST`
- **Path**：`/api/v1/metrics`

### 4.4.4 查询指标配置详情
- **Method**：`GET`
- **Path**：`/api/v1/metrics/{metric_id}`

---

## 4.5 结果与分析

### 4.5.1 查询运行结果汇总
- **Method**：`GET`
- **Path**：`/api/v1/evaluation-runs/{run_id}/summary`

### 4.5.1.1 结果汇总对象
```json
{
  "run_id": 1,
  "summary": "本次评测整体表现良好",
  "report_title": "AI Coding Agent 版本评测报告",
  "report_path": "/reports/run_001.pdf",
  "report_format": "pdf"
}
```

### 4.5.2 查询运行指标明细
- **Method**：`GET`
- **Path**：`/api/v1/evaluation-runs/{run_id}/metrics`

### 4.5.2.1 指标结果对象
```json
{
  "metric_id": 1,
  "metric_code": "task_success_rate",
  "metric_name": "任务成功率",
  "metric_type": "explicit",
  "metric_value": 0.86,
  "metric_text": null,
  "metric_detail": {
    "unit": "%",
    "description": "任务最终完成比例"
  }
}
```

### 4.5.3 查询过程轨迹
- **Method**：`GET`
- **Path**：`/api/v1/evaluation-runs/{run_id}/traces`

### 4.5.3.1 轨迹对象
```json
{
  "step_index": 3,
  "phase": "act",
  "decision": "调用文件写入工具修改首页按钮",
  "observation": "文件写入成功",
  "state_snapshot": {
    "current_sample_id": 1,
    "current_status": "running"
  },
  "tool_calls": [
    {
      "tool_name": "write_file",
      "success": true,
      "duration_ms": 1200
    }
  ],
  "created_at": "2026-04-17T10:06:12Z"
}
```

### 4.5.4 查询工具调用日志
- **Method**：`GET`
- **Path**：`/api/v1/evaluation-runs/{run_id}/tool-calls`

### 4.5.4.1 工具调用对象
```json
{
  "tool_name": "write_file",
  "input_payload": {
    "path": "src/pages/index.tsx"
  },
  "output_payload": {
    "success": true
  },
  "success": true,
  "error_type": null,
  "duration_ms": 1200,
  "created_at": "2026-04-17T10:06:12Z"
}
```

### 4.5.5 导出评测报告
- **Method**：`POST`
- **Path**：`/api/v1/evaluation-runs/{run_id}/export`

**Response**
```json
{
  "report_title": "AI Coding Agent 版本评测报告",
  "report_summary": "本次评测整体表现良好",
  "report_path": "/reports/run_001.pdf",
  "report_format": "pdf",
  "created_at": "2026-04-17T10:10:00Z"
}
```

### 4.5.6 多任务对比分析
- **Method**：`POST`
- **Path**：`/api/v1/analysis/compare`

**Request**
```json
{
  "task_ids": [1, 2],
  "metric_keys": ["task_success_rate", "command_success_rate", "build_success_rate"]
}
```

---

## 4.6 实时状态推送

### 4.6.1 WebSocket 连接
- **Path**：`/api/v1/ws/evaluation-runs/{run_id}`

### 4.6.2 推送内容示例
```json
{
  "event": "run_progress",
  "run_id": 1,
  "status": "running",
  "progress": 0.4,
  "current_step": 4,
  "message": "正在执行第 4 个样本",
  "updated_at": "2026-04-17T10:06:12Z"
}
```

---

## 5. 错误码设计

### 5.1 通用错误码
- `0`：成功
- `40001`：参数错误
- `40004`：资源不存在
- `40009`：资源冲突
- `50000`：系统内部错误

### 5.2 评测相关错误码
- `41001`：任务状态不允许修改
- `41002`：任务状态不允许启动
- `41003`：运行已结束，无法取消
- `41004`：数据集为空
- `41005`：指标配置非法
- `41006`：被测 Agent 调用失败

---

## 6. 权限与审计

### 6.1 权限控制
平台建议支持以下权限：
- 普通用户：创建、执行、查看评测任务
- 管理员：管理数据集、指标与系统配置

### 6.2 审计日志
系统应记录以下关键操作：
- 创建/修改/删除评测任务
- 启动/取消/重试评测运行
- 导入/删除数据集
- 指标配置变更
- 导出评测报告

---

## 7. 与任务1的对接说明

任务2平台面向任务1这类 AI Coding Agent 时，建议任务1提供以下数据，以便任务2进行评估：
- 输入参数
- 最终输出
- 中间步骤轨迹
- 工具调用日志
- 执行耗时
- 成功/失败状态
- 可选参考上下文或检索结果
- 代码片段或文件变更记录
- 命令执行结果
- 快照/回滚结果

这样任务2即可同时支持：
- 结果型评估
- 过程型评估
- 显式指标评估
- 基于 Ragas 的指标评估
- 代码生成/修改/执行类任务评估

---

## 8. 版本记录
- v1.0：初版 API 设计文档，覆盖任务、运行、数据集、指标、结果分析和 WebSocket 推送能力
- v1.1：适配 AI Coding Agent MVP 场景，调整数据集样本类型、指标命名和结果展示内容
