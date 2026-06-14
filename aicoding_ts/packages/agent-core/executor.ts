import type { LlmClient } from '../llm-client/index.ts';
import type { ChatMessage, AssistantMessage, ToolResultMessage, ToolCall, AgentEvent, FileDiff } from '../shared/types.ts';
import type { ExternalMcpTool } from '../mcp-client/index.ts';
import type { CommandConfirmHook } from '../tool-gateway/run-command.ts';
import { enrichToolResult } from '../tool-gateway/tool-fallback.ts';
import type { SkillActivationResult, SkillReadResult, SkillSummary, SkillTrigger } from '../skill-system/index.ts';
import { LOCAL_TOOL_DEFINITIONS, SKILL_TOOL_DEFINITIONS } from './tool-definitions.ts';

export type ToolGateway = {
  readFile: (path: string) => Promise<unknown> | unknown;
  writeFile: (path: string, content: string) => unknown;
  runCommand: (command: string, ctx?: { onCommandConfirm?: CommandConfirmHook }) => unknown;
  readLints?: (path?: string) => unknown;
  diffFile?: (path: string, snapshotId?: string) => unknown;
  listWorkspace: () => unknown;
  searchInWorkspace: (query: string, path?: string) => unknown;
  patchFile: (path: string, patch: string) => unknown;
  listVersions: () => unknown;
  createSnapshot: (name?: string, description?: string) => unknown;
  restoreSnapshot: (snapshotId: string) => unknown;
  isToolEnabled?: (name: string) => boolean;
};

type ExternalMcpRegistry = {
  listTools: () => Promise<ExternalMcpTool[]>;
  callTool: (qualifiedName: string, args?: Record<string, unknown>) => Promise<unknown>;
  hasExternalTools: () => boolean;
  normalizeToolName: (serverName: string, toolName: string) => string;
};

type SkillRegistry = {
  listSkills: () => SkillSummary[];
  readSkill: (name: string) => SkillReadResult;
  activateSkill: (name: string, trigger: SkillTrigger, reason?: string) => SkillActivationResult;
  deactivateSkill: (name: string, reason?: string) => SkillActivationResult;
};

export type ConfirmHook = (question: string, options?: string[]) => Promise<string>;

export type LoopResult = {
  messages: ChatMessage[];
  finalContent: string;
  toolsUsed: string[];
  filesModified: string[];
  skillsUsed: string[];
};

const MAX_ITERATIONS = 20;

export type ReActLoopOptions = {
  maxIterations?: number;
};

export type Executor = ReturnType<typeof createExecutor>;

const LOCAL_TOOL_DEFINITIONS = [
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
      name: 'patch_file',
      description: '根据局部补丁修改工作区中的文件，优先用于修改已有文件',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, patch: { type: 'string' } },
        required: ['path', 'patch'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_in_workspace',
      description: '在工作区中搜索文本或代码片段',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' }, path: { type: 'string' } },
        required: ['query'],
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
  {
    type: 'function',
    function: {
      name: 'list_versions',
      description: '列出当前工作区的版本快照',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_snapshot',
      description: '为当前工作区创建一个可回滚的版本快照',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'restore_snapshot',
      description: '从指定版本快照恢复当前工作区',
      parameters: {
        type: 'object',
        properties: { snapshotId: { type: 'string' } },
        required: ['snapshotId'],
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

export type ExecutorHooks = {
  onConfirm?: ConfirmHook;
  onCommandConfirm?: CommandConfirmHook;
};

export function createExecutor(toolGateway: ToolGateway, externalMcpRegistry?: ExternalMcpRegistry, skillRegistry?: SkillRegistry) {
  const toolFns: Record<string, (args: Record<string, unknown>) => unknown> = {
    read_file: ({ path }) => toolGateway.readFile(path as string),
    write_file: ({ path, content }) => toolGateway.writeFile(path as string, content as string),
    patch_file: ({ path, patch }) => toolGateway.patchFile(path as string, patch as string),
    search_in_workspace: ({ query, path }) => toolGateway.searchInWorkspace(query as string, path as string | undefined),
    run_command: ({ command }) =>
      toolGateway.runCommand(command as string),
    read_lints: ({ path }) =>
      toolGateway.readLints ? toolGateway.readLints(path as string | undefined) : { error: 'read_lints 不可用' },
    diff_file: ({ path, snapshotId }) =>
      toolGateway.diffFile
        ? toolGateway.diffFile(path as string, snapshotId as string | undefined)
        : { error: 'diff_file 不可用' },
    list_workspace: () => toolGateway.listWorkspace(),
    list_versions: () => toolGateway.listVersions(),
    create_snapshot: ({ name, description }) => toolGateway.createSnapshot(name as string | undefined, description as string | undefined),
    restore_snapshot: ({ snapshotId }) => toolGateway.restoreSnapshot(snapshotId as string),
  };

  function filterEnabledTools<T extends { function: { name: string } }>(tools: T[]): T[] {
    if (!toolGateway.isToolEnabled) return tools;
    return tools.filter((t) => toolGateway.isToolEnabled!(t.function.name));
  }

  async function buildToolDefinitions() {
    const localDefinitions = skillRegistry ? [...LOCAL_TOOL_DEFINITIONS, ...SKILL_TOOL_DEFINITIONS] : LOCAL_TOOL_DEFINITIONS;
    const localTools = filterEnabledTools(localDefinitions);
    if (!externalMcpRegistry || !externalMcpRegistry.hasExternalTools()) return localTools;

    const externalTools = await externalMcpRegistry.listTools();
    const mapped = externalTools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: externalMcpRegistry.normalizeToolName(tool.server, tool.name),
        description: `[external:${tool.server}] ${tool.description || tool.name}`,
        parameters: Object.keys(tool.inputSchema).length > 0
          ? tool.inputSchema
          : { type: 'object', properties: {}, additionalProperties: true },
      },
    }));

    return [...localTools, ...mapped];
  }

  return {
    async runReActLoop(
      llmClient: LlmClient,
      messages: ChatMessage[],
      onEvent: (event: AgentEvent) => void,
      hooks?: ConfirmHook | ExecutorHooks,
    ): Promise<LoopResult> {
      const onConfirm =
        typeof hooks === 'function' ? hooks : hooks?.onConfirm;
      const onCommandConfirm =
        typeof hooks === 'object' && hooks && 'onCommandConfirm' in hooks
          ? hooks.onCommandConfirm
          : undefined;
      const workingMessages: ChatMessage[] = [...messages];
      const loopMessages: ChatMessage[] = [];
      const toolsUsed: string[] = [];
      const filesModified: string[] = [];
      const skillsUsed: string[] = [];
      let finalContent = '';
      const maxIterations = options.maxIterations ?? MAX_ITERATIONS;

      for (let i = 0; i < maxIterations; i++) {
        const toolDefinitions = await buildToolDefinitions();
        const result = await llmClient.createMessage(workingMessages, {
          tools: toolDefinitions,
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

        if (toolCalls.length === 0 || finishReason === 'stop') {
          break;
        }

        for (const call of toolCalls) {
          const toolName = call.function.name;
          toolsUsed.push(toolName);

          let toolResult: unknown;

          if (toolName === 'ask_user') {
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
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* ignore */ }

            if (toolName === 'list_skills' && skillRegistry) {
              toolResult = { skills: skillRegistry.listSkills() };
              onEvent({ type: 'skill', skill: '*', action: 'listed', summary: 'Listed available skills' });
            } else if (toolName === 'read_skill' && skillRegistry) {
              const name = String(args.name ?? '');
              toolResult = skillRegistry.readSkill(name);
              if ((toolResult as SkillReadResult).ok) {
                onEvent({ type: 'skill', skill: name, action: 'read', summary: `Loaded skill: ${name}` });
              }
            } else if (toolName === 'activate_skill' && skillRegistry) {
              const name = String(args.name ?? '');
              const trigger = args.trigger === 'explicit' ? 'explicit' : 'implicit';
              const reason = typeof args.reason === 'string' ? args.reason : undefined;
              toolResult = skillRegistry.activateSkill(name, trigger, reason);
              if ((toolResult as SkillActivationResult).ok) {
                if (!skillsUsed.includes(name)) skillsUsed.push(name);
                onEvent({ type: 'skill', skill: name, action: 'activated', trigger, reason, summary: `Activated skill: ${name}` });
              }
            } else if (toolName === 'deactivate_skill' && skillRegistry) {
              const name = String(args.name ?? '');
              const reason = typeof args.reason === 'string' ? args.reason : undefined;
              toolResult = skillRegistry.deactivateSkill(name, reason);
              onEvent({ type: 'skill', skill: name, action: 'deactivated', reason, summary: `Deactivated skill: ${name}` });
            } else {
              const fn = toolFns[toolName];
              if (fn) {
              try {
                if (toolName === 'run_command' && onCommandConfirm) {
                  toolResult = await toolGateway.runCommand(args.command as string, {
                    onCommandConfirm,
                  });
                } else {
                  toolResult = await fn(args);
                }
              } catch (err) {
                toolResult = { error: String(err) };
              }
            } else if (toolName.startsWith('mcp__') && externalMcpRegistry) {
              try {
                toolResult = await externalMcpRegistry.callTool(toolName, args);
              } catch (err) {
                toolResult = { error: String(err) };
              }
            } else {
              toolResult = { error: `未知工具: ${toolName}` };
            }
            }

            toolResult = enrichToolResult(toolName, toolResult);

            if (toolName === 'write_file' || toolName === 'patch_file') {
              if (typeof args.path === 'string') filesModified.push(args.path);
            } else if (toolName === 'restore_snapshot') {
              filesModified.push('[workspace restored from snapshot]');
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

      return { messages: loopMessages, finalContent, toolsUsed, filesModified, skillsUsed };
    },
  };
}
