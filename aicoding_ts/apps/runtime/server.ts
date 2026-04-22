import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createAgentCore } from '../../packages/agent-core/index.ts';
import { createContextBuilder } from '../../packages/context-builder/index.ts';
import { createDoubaoClient } from '../../packages/llm-client/index.ts';
import { createToolGateway } from '../../packages/tool-gateway/index.ts';
import { createWorkspaceManager } from '../../packages/workspace-manager/index.ts';

type RequestContext = {
  path?: string;
  content?: string;
  nextName?: string;
  command?: string;
  prompt?: string;
  selectedFile?: string | null;
};

type WorkspaceFile = {
  path: string;
  content?: string;
};

type WorkspaceTreeResponse = {
  tree: unknown[];
};

type FileUpdateResponse = {
  ok: true;
  file: WorkspaceFile;
  tree: unknown[];
  action: string;
};

type PreviewEvent =
  | { type: 'chunk'; chunk: string }
  | { type: 'tool'; tool: string; summary?: string; detail?: string }
  | { type: 'result'; result: unknown }
  | { type: 'error'; message: string };

type ToolGateway = ReturnType<typeof createToolGateway>;
type WorkspaceManager = ReturnType<typeof createWorkspaceManager>;
type AgentCore = ReturnType<typeof createAgentCore>;

type PreviewPayload = {
  prompt?: string;
  selectedFile?: string | null;
};

const port = Number(process.env.PORT || 3000);
const webRoot = join(process.cwd(), 'apps', 'web');
const webDistRoot = join(webRoot, 'dist');

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

async function parseBody<T extends RequestContext>(req: IncomingMessage): Promise<T> {
  let body = '';
  for await (const chunk of req) body += chunk;
  return (body ? JSON.parse(body) : {}) as T;
}

const workspaceManager: WorkspaceManager = createWorkspaceManager();
const toolGateway: ToolGateway = createToolGateway(workspaceManager);
const contextBuilder = createContextBuilder(toolGateway);
const llmClient = process.env.DOUBAO_API_KEY && process.env.DOUBAO_MODEL ? createDoubaoClient() : null;
const agentCore: AgentCore = createAgentCore(contextBuilder, toolGateway, llmClient);

await workspaceManager.loadFromDisk();

async function tryReadStaticFile(pathname: string) {
  const candidates = [join(webDistRoot, pathname), join(webRoot, pathname)];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch {
      continue;
    }
  }
  return null;
}

function isWorkspaceFile(value: unknown): value is WorkspaceFile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkspaceFile>;
  return typeof candidate.path === 'string';
}

function isPreviewEvent(value: unknown): value is PreviewEvent {
  if (!value || typeof value !== 'object') return false;
  return 'type' in value;
}

export function startRuntimeServer() {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (url.pathname === '/api/meta') {
      sendJson(res, 200, {
        appName: 'AI Coding Agent Web MVP',
        llmEnabled: Boolean(llmClient),
        provider: llmClient ? 'doubao-ark' : 'mock',
      });
      return;
    }

    if (url.pathname === '/api/workspace') {
      const treeResponse: WorkspaceTreeResponse = { tree: workspaceManager.listTree() };
      sendJson(res, 200, treeResponse);
      return;
    }

    if (url.pathname.startsWith('/api/file/') && req.method === 'GET') {
      const filePath = decodeURIComponent(url.pathname.replace('/api/file/', ''));
      const file = toolGateway.readFile(filePath) as WorkspaceFile | null;
      if (!isWorkspaceFile(file)) {
        sendJson(res, 404, { error: 'File not found' });
        return;
      }
      sendJson(res, 200, file);
      return;
    }

    if (url.pathname === '/api/file' && req.method === 'PUT') {
      const parsed = await parseBody<RequestContext>(req);
      const updated = (await agentCore.writeFile(parsed.path ?? '', parsed.content ?? '')) as FileUpdateResponse;
      sendJson(res, 200, { ok: true, file: updated.file, tree: updated.tree, action: updated.action });
      return;
    }

    if (url.pathname === '/api/folder' && req.method === 'PUT') {
      const parsed = await parseBody<RequestContext>(req);
      const created = await workspaceManager.createFolder(parsed.path ?? '');
      sendJson(res, 200, created);
      return;
    }

    if (url.pathname === '/api/item/rename' && req.method === 'POST') {
      const parsed = await parseBody<RequestContext>(req);
      const renamed = await workspaceManager.renameItem(parsed.path ?? '', parsed.nextName ?? '');
      sendJson(res, 200, renamed);
      return;
    }

    if (url.pathname === '/api/item/delete' && req.method === 'POST') {
      const parsed = await parseBody<RequestContext>(req);
      const deleted = await workspaceManager.deleteItem(parsed.path ?? '');
      sendJson(res, 200, deleted);
      return;
    }

    if (url.pathname === '/api/tool/run' && req.method === 'POST') {
      const parsed = await parseBody<RequestContext>(req);
      const result = await agentCore.runCommand(parsed.command ?? '');
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/api/agent/preview' && req.method === 'POST') {
      const parsed = await parseBody<PreviewPayload>(req);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });

      const writeEvent = (event: PreviewEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      try {
        const result = await agentCore.preview(parsed.prompt ?? '', parsed.selectedFile ?? null, (chunk) => {
          if (typeof chunk === 'string') {
            writeEvent({ type: 'chunk', chunk });
            return;
          }
          if (isPreviewEvent(chunk)) {
            writeEvent(chunk);
          }
        });
        writeEvent({ type: 'result', result });
      } catch (error: unknown) {
        writeEvent({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
      }

      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const content = await tryReadStaticFile(pathname);

    if (content) {
      const type = mimeTypes[extname(pathname)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(content);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  server.listen(port, () => {
    console.log(`AI Coding Agent Web MVP running at http://localhost:${port}`);
  });
}
