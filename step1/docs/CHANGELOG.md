# 变更日志 (CHANGELOG)

本文档记录 step1 迭代一评估框架自初始版本以来的所有变更，供贡献者了解项目演进。

---

## [2026-03-23] 指标修复与 PlanQuality 重构

### 1. ToolCallAccuracy 参数比较修复

**修改文件**：`src/metrics/tool_call_accuracy.py`

**问题**：参数比较使用直接 `==`，当 JSON 解析后类型不一致时（如 `5` vs `"5"`）会误判为不匹配。

**修复**：对齐 Ragas 的 `exact_match_args` 实现，将参数值转为字符串后再比较：
```python
# 修复前
if k in preds and preds[k] == v:
# 修复后
if k in preds and str(preds[k]) == str(v):
```

### 2. ToolCallAccuracy 非严格模式修复

**修改文件**：`src/metrics/tool_call_accuracy.py`

**问题**：`strict_order=False` 时，只对工具名列表做排序检查 `aligned`，但 `zip` 配对时仍使用原始未排序的列表，导致工具名无法正确配对，非严格模式形同虚设。

**修复**：对齐 Ragas 的排序逻辑，新增 `_sorted_key` 函数（对应 Ragas 的 `sorted_key_for_tool_call`），非严格模式下先按工具名+参数排序再进行后续计算。

### 3. PlanQuality 全面重构

**修改文件**：`src/metrics/plan_quality.py`

**问题**：旧实现只做三项粗粒度检查（重复工具计数、缺失工具、步骤长度差），惩罚系数过小，均值 0.95 几乎无区分度。无法检测 PDF 要求的"死循环"和"逻辑断层"。

**重构内容**：基于对 27 个评估样本的实际分析，新增 5 项检测：

| 检测项 | 说明 | 每项扣分 |
| --- | --- | --- |
| 无效工具 | 调用系统中不存在的工具（如 `get_menu`、`submit_payment`） | -0.15 |
| 死循环 | 相邻步骤调用同一工具（错误重试模式） | -0.10 |
| 逻辑断层 | 跳过前置依赖（如未 `search_products` 就直接 `place_order`） | -0.10 |
| 缺失工具 | 期望工具未出现在实际调用中 | -0.10 |
| 冗余步骤 | 实际步骤数多于期望步骤数 | -0.05 |

**效果**：均值从 0.95 降至 0.91，分数范围从 0.85~1.0 拉开至 0.55~1.0，有效区分了不同质量的规划轨迹。

### 4. 测试更新

**修改文件**：`tests/unit/test_tool_call_accuracy.py`、`tests/unit/test_plan_quality.py`

- ToolCallAccuracy：修复非严格模式测试预期值，新增类型不一致测试（共 10 个测试）
- PlanQuality：重写测试套件，覆盖无效工具、死循环、逻辑断层等场景（共 11 个测试）

### 5. 评估报告更新

**修改文件**：`docs/评估报告.md`

- 修正 task_completion 均值（1.0 → 0.9259）和 plan_quality 均值（0.95 → 0.9093）
- 补充各指标与 Ragas 的对应关系
- 新增 PlanQuality 低分样本的具体分析

---

## [2026-03-21] 项目结构迁移 & 工程化增强

### 1. 目录结构重组

将原 `迭代1/` 目录迁移为 `step1/`，保持源码、数据、文档、报告的目录分层不变。

```
step1/
├── .env.example          # 新增：环境变量模板
├── .gitignore            # 新增：step1 级别的忽略规则
├── requirements.txt      # 新增：Python 依赖清单
├── data/                 # 评估数据集
├── docs/                 # 设计文档、评估报告
├── logs/                 # 新增：运行日志（git 忽略）
├── reports/              # 评估报告输出
├── src/                  # 源码
│   ├── config.py         # 新增：集中配置管理
│   ├── main.py
│   ├── data/
│   ├── evaluator/
│   ├── metrics/
│   └── utils/
│       ├── logger.py     # 新增：统一日志模块
│       ├── hashable.py
│       └── text_norm.py
└── tests/                # 新增：完整测试套件
    ├── conftest.py
    ├── unit/
    ├── integration/
    └── e2e/
```

### 2. 环境配置系统（`config.py` + `.env`）

**新增文件**：`src/config.py`、`.env.example`

**变更说明**：

- 引入 `python-dotenv`，从项目根目录 `.env` 文件加载配置
- 支持 `Software3_1_<NAME>` 前缀的环境变量（课程项目约定），也兼容通用名称
- 提供模块级常量，`import` 即可用：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `LLM_API_KEY` | 无 | OpenAI 兼容 API Key（必填） |
| `LLM_BASE_URL` | 无 | 自定义 API 端点（可选，如 LiteLLM 代理） |
| `LLM_MODEL` | `gpt-4.1` | 模型名称 |
| `LOG_LEVEL` | `INFO` | 日志级别 |
| `MAX_LOG_LINES` | `2000` | 日志文件最大行数 |
| `DEBUG` | `0` | 调试模式开关 |

**贡献者须知**：

- 复制 `.env.example` 为 `.env`，填入真实的 `LLM_API_KEY`
- `.env` 已在 `.gitignore` 中排除，**不要提交**

### 3. LLM 客户端适配（`task_completion.py`）

**修改文件**：`src/metrics/task_completion.py`

**变更说明**：

- 使用 `openai` 库的 OpenAI 兼容客户端替换原有硬编码调用
- 支持通过 `LLM_BASE_URL` 配置自定义端点（如 LiteLLM、Azure OpenAI 等）
- 增加超时（30s）和最大重试（1 次）设置
- 缺少 API Key 或 `openai` 包时自动 fallback 到规则评分
- 添加详细的日志输出（请求发送、原始响应、解析结果）

### 4. 统一日志模块（`logger.py`）

**新增文件**：`src/utils/logger.py`

**功能**：

- **双输出**：控制台（stdout）+ 文件（`logs/eval.log`）
  - 控制台输出到 `stdout`（而非默认的 `stderr`），避免 PyCharm 中日志标红
  - 文件始终记录 `DEBUG` 级别，控制台受 `LOG_LEVEL` 控制
- **自动清理**：日志文件超过 `MAX_LOG_LINES` 时保留最新的 `MAX_LOG_LINES` 行
  - 触发时机：进程启动时 + 每次 `run()` 结束时
  - 裁剪时会关闭并重新打开 FileHandler，避免文件指针偏移
- **可视化分隔符**：
  - `log_run_start(total)` — 运行间大分隔：3 空行 + `========` 粗横线
  - `log_sample_start(task_id, idx, total)` — 样本间中分隔：1 空行 + `--------` 细横线

**公开 API**：

```python
from utils.logger import get_logger, log_run_start, log_sample_start, trim_if_needed

logger = get_logger(__name__)       # 获取 logger
log_run_start(total=27)             # 评估运行开始
log_sample_start("task_001", 1, 27) # 样本开始
trim_if_needed()                    # 手动触发日志裁剪
```

### 5. 评估运行器增强（`runner.py`）

**修改文件**：`src/evaluator/runner.py`

**变更说明**：

- 集成日志模块，在评估流程中插入分隔符
- 每个样本评估后打印各指标得分
- 运行结束后自动调用 `trim_if_needed()` 裁剪日志

### 6. 测试套件

**新增文件**：`tests/` 目录下全部文件

**结构**：

| 层级 | 文件 | 覆盖内容 |
| --- | --- | --- |
| 单元测试 | `test_loader.py` | 数据加载、Schema 验证 |
| 单元测试 | `test_task_completion.py` | 任务完成度（规则 + LLM mock） |
| 单元测试 | `test_plan_quality.py` | 计划质量评分 |
| 单元测试 | `test_tool_call_accuracy.py` | 工具调用准确率 |
| 单元测试 | `test_tool_call_f1.py` | 工具调用 F1 值 |
| 集成测试 | `test_runner.py` | 评估运行器 + Markdown 报告生成 |
| 端到端测试 | `test_main_e2e.py` | 27 个样本完整评估流程 |

**运行方式**：

```bash
cd step1
pip install -r requirements.txt
python -m pytest tests/ -q
```

### 7. 依赖管理

**新增文件**：`requirements.txt`

```
openai>=1.0
python-dotenv>=1.0
httpx
pytest>=7.0
```

---

## 贡献指南

1. **环境准备**：`cp .env.example .env` 并填入 `LLM_API_KEY`
2. **安装依赖**：`pip install -r requirements.txt`
3. **运行测试**：`cd step1 && python -m pytest tests/ -q`（应 55 个测试全部通过）
4. **日志查看**：运行后查看 `step1/logs/eval.log`
5. **添加新指标**：继承 `src/metrics/base.py` 中的 `Metric` 基类，实现 `score()` 方法
6. **配置项**：所有配置通过 `.env` 管理，新增配置项请同步更新 `.env.example` 和 `config.py`