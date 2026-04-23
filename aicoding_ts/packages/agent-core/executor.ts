import type { LlmClient } from '../llm-client/index.ts';

type ToolGateway = {
  readFile: (path: string) => unknown;
  writeFile: (path: string, content: string) => unknown;
  runCommand: (command: string) => unknown;
  listWorkspace: () => unknown;
};

function extractTextFromMessage(message: any): string {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (Array.isArray(message.content)) {
    return message.content.map((part: any) => (typeof part === 'string' ? part : part?.text ?? '')).join('');
  }
  return message.content ?? '';
}

function normalizeToolCalls(choice: any) {
  const toolCalls = choice?.message?.tool_calls ?? choice?.delta?.tool_calls ?? [];
  return toolCalls.map((call: any) => ({
    id: call.id,
    name: call.function?.name,
    arguments: call.function?.arguments ?? '{}',
  }));
}

function toolSummary(result: unknown): string {
  if (result && typeof result === 'object') return JSON.stringify(result, null, 2);
  return String(result);
}

export function createExecutor(toolGateway: ToolGateway) {
  const tools: Record<string, (args: any) => unknown> = {
    read_file: ({ path }) => toolGateway.readFile(path),
    write_file: ({ path, content }) => toolGateway.writeFile(path, content),
    run_command: ({ command }) => toolGateway.runCommand(command),
    list_workspace: () => toolGateway.listWorkspace(),
  };

  return {
    async runModel(llmClient: LlmClient, messages: unknown[], onChunk?: (chunk: unknown) => void) {
      const result = await llmClient.createMessage(messages, {
        tools: [
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
        ],
        tool_choice: 'auto',
        parallel_tool_calls: true,
      }) as { choices?: Array<{ message?: unknown; delta?: unknown }> };

      const choice = result?.choices?.[0] ?? {};
      const content = extractTextFromMessage((choice as any).message);
      const toolCalls = normalizeToolCalls(choice);

      if (onChunk && content) onChunk(content);

      const toolResults: Array<{ name: string; args: unknown; result: unknown }> = [];
      for (const call of toolCalls) {
        const tool = tools[call.name];
        if (!tool) continue;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.arguments || '{}');
        } catch {
          args = {};
        }
        const toolResult = await tool(args);
        toolResults.push({ name: call.name, args, result: toolResult });
        if (onChunk) {
          onChunk({
            type: 'tool',
            tool: call.name,
            summary: `工具调用结果：${call.name}`,
            detail: toolSummary(toolResult),
          });
        }
      }

      return { result, content, toolCalls, toolResults };
    },
  };
}
