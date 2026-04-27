import type { LlmClient } from '../llm-client/index.ts';
import type { ChatMessage, AssistantMessage, ToolResultMessage, ToolCall, AgentEvent } from '../shared/types.ts';

type ToolGateway = {
  readFile: (path: string) => Promise<unknown> | unknown;
  writeFile: (path: string, content: string) => unknown;
  runCommand: (command: string) => unknown;
  listWorkspace: () => unknown;
};

export type ConfirmHook = (question: string, options?: string[]) => Promise<string>;

export type LoopResult = {
  messages: ChatMessage[];
  finalContent: string;
  toolsUsed: string[];
  filesModified: string[];
};

const MAX_ITERATIONS = 20;

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取工作区中的文件内容',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: '写入工作区中的文件内容',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: '在工作区目录中执行命令',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_workspace',
      description: '列出当前工作区文件树',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: '当需要用户确认某个操作或提供额外信息时调用此工具，agent 会暂停执行直到用户响应',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: '向用户提出的问题' },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: '可选的预设答案选项，不提供则用户自由输入',
          },
        },
        required: ['question'],
        additionalProperties: false,
      },
    },
  },
];

function extractText(message: unknown): string {
  if (!message || typeof message !== 'object') return '';
  const msg = message as Record<string, unknown>;
  if (Array.isArray(msg.content)) {
    return (msg.content as unknown[])
      .map((part) => (typeof part === 'string' ? part : (part as Record<string, unknown>)?.text ?? ''))
      .join('');
  }
  return typeof msg.content === 'string' ? msg.content : '';
}

function extractToolCalls(message: unknown): ToolCall[] {
  if (!message || typeof message !== 'object') return [];
  const msg = message as Record<string, unknown>;
  const raw = msg.tool_calls;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c) => ({
      id: String(c.id ?? ''),
      type: 'function' as const,
      function: {
        name: String((c.function as Record<string, unknown>)?.name ?? ''),
        arguments: String((c.function as Record<string, unknown>)?.arguments ?? '{}'),
      },
    }));
}

function toolSummary(result: unknown): string {
  if (result && typeof result === 'object') return JSON.stringify(result, null, 2);
  return String(result);
}

export function createExecutor(toolGateway: ToolGateway) {
  const toolFns: Record<string, (args: Record<string, unknown>) => unknown> = {
    read_file: ({ path }) => toolGateway.readFile(path as string),
    write_file: ({ path, content }) => toolGateway.writeFile(path as string, content as string),
    run_command: ({ command }) => toolGateway.runCommand(command as string),
    list_workspace: () => toolGateway.listWorkspace(),
  };

  return {
    async runReActLoop(
      llmClient: LlmClient,
      messages: ChatMessage[],
      onEvent: (event: AgentEvent) => void,
      onConfirm?: ConfirmHook,
    ): Promise<LoopResult> {
      const workingMessages: ChatMessage[] = [...messages];
      const loopMessages: ChatMessage[] = [];
      const toolsUsed: string[] = [];
      const filesModified: string[] = [];
      let finalContent = '';

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const result = await llmClient.createMessage(workingMessages, {
          tools: TOOL_DEFINITIONS,
          tool_choice: 'auto',
          parallel_tool_calls: false,
        }) as { choices?: Array<{ message?: unknown; finish_reason?: string }> };

        const choice = result?.choices?.[0];
        const rawMessage = (choice as Record<string, unknown> | undefined)?.message;
        const finishReason = (choice as Record<string, unknown> | undefined)?.finish_reason;

        const content = extractText(rawMessage);
        const toolCalls = extractToolCalls(rawMessage);

        const assistantMsg: AssistantMessage = {
          role: 'assistant',
          content: content || null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        };
        workingMessages.push(assistantMsg);
        loopMessages.push(assistantMsg);

        if (content) {
          finalContent = content;
          onEvent({ type: 'chunk', chunk: content });
        }

        // 无工具调用或模型主动停止：loop 结束
        if (toolCalls.length === 0 || finishReason === 'stop') {
          break;
        }

        // 逐个执行工具调用
        for (const call of toolCalls) {
          const toolName = call.function.name;
          toolsUsed.push(toolName);

          let toolResult: unknown;

          if (toolName === 'ask_user') {
            // 特殊工具：暂停 loop，等待用户确认
            if (onConfirm) {
              let args: { question?: string; options?: string[] } = {};
              try { args = JSON.parse(call.function.arguments); } catch { /* ignore */ }
              onEvent({ type: 'task_status', taskId: '', status: 'waiting_confirm' });
              const answer = await onConfirm(args.question ?? '请确认', args.options);
              toolResult = { answer };
            } else {
              toolResult = { answer: '已确认' };
            }
          } else {
            const fn = toolFns[toolName];
            if (!fn) {
              toolResult = { error: `未知工具: ${toolName}` };
            } else {
              let args: Record<string, unknown> = {};
              try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* ignore */ }
              try {
                toolResult = await fn(args);
              } catch (err) {
                toolResult = { error: String(err) };
              }
            }

            // 记录文件写入
            if (toolName === 'write_file') {
              let args: Record<string, unknown> = {};
              try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* ignore */ }
              if (typeof args.path === 'string') filesModified.push(args.path);
            }
          }

          onEvent({
            type: 'tool',
            tool: toolName,
            summary: `工具调用：${toolName}`,
            detail: toolSummary(toolResult),
          });

          const toolResultMsg: ToolResultMessage = {
            role: 'tool',
            tool_call_id: call.id,
            name: toolName,
            content: JSON.stringify(toolResult),
          };
          workingMessages.push(toolResultMsg);
          loopMessages.push(toolResultMsg);
        }
      }

      return { messages: loopMessages, finalContent, toolsUsed, filesModified };
    },
  };
}
