# MyClaw 前端 WebSocket 对接说明（Vue 版本）

> 目标：前端通过 WebSocket 接收后端运行状态推送，实现任务执行过程实时可视化。

---

## 1. 对接目标

前端需要实现：
1. 创建任务并启动运行；
2. 建立 WebSocket 连接订阅 `run_id`；
3. 实时展示状态、步骤、工具调用、失败原因；
4. 任务结束后展示最终结论与日志。

---

## 2. 后端接口约定（对应后端骨架）

- `POST /api/tasks`：创建任务
- `POST /api/tasks/{task_id}/run`：启动任务，返回 `run_id`
- `GET /api/runs/{run_id}`：运行摘要（页面刷新后恢复）
- `GET /api/runs/{run_id}/trace`：步骤轨迹
- `GET /api/runs/{run_id}/tool-calls`：工具调用日志
- `WS /ws/runs/{run_id}`：实时状态推送

---

## 3. WebSocket 消息结构

统一格式：

```json
{
  "event": "run.step",
  "run_id": "run_001",
  "trace_id": "trace_001",
  "timestamp": "2026-04-10T12:00:10Z",
  "data": {}
}
```

常见 `event`：
- `run.started`
- `run.status`
- `run.step`
- `run.tool_call`
- `run.retry`
- `run.failed`
- `run.succeeded`

---

## 4. Vue 页面状态设计（建议）

建议在页面 Store（Pinia）或组件状态中维护：

```ts
interface RunRealtimeState {
  runId: string;
  traceId?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'degraded';
  progressText: string;
  currentPhase?: string;
  steps: Array<{
    stepIndex?: number;
    phase: string;
    message: string;
    timestamp: string;
  }>;
  toolCalls: Array<{
    toolName: string;
    success: boolean;
    durationMs?: number;
    errorType?: string;
    timestamp: string;
  }>;
  retries: number;
  finalSummary?: string;
  errorMessage?: string;
}
```

---

## 5. 前端对接流程

1. 用户点击“创建任务” -> 调用 `POST /api/tasks`
2. 调用 `POST /api/tasks/{task_id}/run` 获取 `run_id`
3. 前端连接 `ws://<host>/ws/runs/{run_id}`
4. 按事件类型更新页面状态
5. 收到 `run.succeeded/run.failed` 后关闭连接（或保留只读）
6. 调用 `GET /api/runs/{run_id}` 做最终校准

---

## 6. Vue WebSocket 最小实现（示例）

```ts
// composables/useRunWebSocket.ts
import { ref, onBeforeUnmount } from 'vue';

export function useRunWebSocket(baseWsUrl: string) {
  const ws = ref<WebSocket | null>(null);
  const connected = ref(false);

  const connect = (
    runId: string,
    onMessage: (payload: any) => void,
    onClose?: () => void
  ) => {
    const url = `${baseWsUrl}/ws/runs/${runId}`;
    ws.value = new WebSocket(url);

    ws.value.onopen = () => {
      connected.value = true;
    };

    ws.value.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        onMessage(payload);
      } catch {
        // ignore invalid payload
      }
    };

    ws.value.onclose = () => {
      connected.value = false;
      onClose?.();
    };

    ws.value.onerror = () => {
      // 可在这里做告警提示
    };
  };

  const disconnect = () => {
    ws.value?.close();
    ws.value = null;
    connected.value = false;
  };

  onBeforeUnmount(disconnect);

  return { connect, disconnect, connected };
}
```

---

## 7. 事件处理建议（前端）

按 `event` 分类处理：

- `run.started`
  - `status = running`
  - `progressText = "任务已启动"`

- `run.status`
  - 更新状态与阶段文本

- `run.step`
  - 追加到 `steps[]`
  - 更新当前阶段

- `run.tool_call`
  - 追加到 `toolCalls[]`
  - 失败时在 UI 高亮

- `run.retry`
  - `retries += 1`
  - 显示“自动重试中”

- `run.failed`
  - `status = failed`
  - 记录错误信息
  - 弹出“查看日志”入口

- `run.succeeded`
  - `status = success`
  - 记录最终摘要
  - 可触发成功提示

---

## 8. 断线与恢复策略（必做）

1. WebSocket 断线后自动重连（最多 3~5 次）；
2. 重连失败时降级为轮询：
   - 每 3 秒请求 `GET /api/runs/{run_id}`；
3. 页面刷新后：
   - 根据 URL 上的 `run_id` 拉取 run 摘要 + trace；
   - 再尝试重新建立 WS。

---

## 9. 页面展示建议（Vue + Ant Design Vue / Element Plus）

1. 顶部状态卡片
- 任务状态、开始时间、耗时、重试次数

2. 中部执行时间线
- 展示 `steps`（phase + message + 时间）

3. 工具调用日志表格
- tool、success、duration、errorType

4. 底部最终结论
- TL;DR
- 失败建议/下一步动作

---

## 10. 最小验收标准

前端满足以下即对接成功：
- 能启动任务并自动建立 WS 连接；
- 能实时看到阶段变化与步骤追加；
- 失败时能显示错误与重试信息；
- 结束时能显示最终摘要；
- 断线后可恢复或降级到轮询。

---

## 11. 常见问题

1. **收不到消息**
- 检查 `run_id` 是否一致；
- 检查 WS URL 是否走了正确网关路径；
- 检查后端是否在每步都调用了 broadcast。

2. **跨域问题**
- 后端需配置 CORS（HTTP）与 WS 网关代理规则。

3. **页面刷新后状态丢失**
- 用 `run_id` 回查数据库，不依赖前端内存状态。

4. **消息乱序**
- 使用 `timestamp` 或 `step_index` 在前端排序显示。