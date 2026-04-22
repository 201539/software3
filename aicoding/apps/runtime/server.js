import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createAgentCore } from '../../packages/agent-core/index.js';
import { createContextBuilder } from '../../packages/context-builder/index.js';
import { createDoubaoClient } from '../../packages/llm-client/index.js';
import { createToolGateway } from '../../packages/tool-gateway/index.js';
import { createWorkspaceManager } from '../../packages/workspace-manager/index.js';

const port = process.env.PORT || 3000;
const publicDir = join(process.cwd(), 'apps', 'web');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

const workspaceManager = createWorkspaceManager();
const toolGateway = createToolGateway(workspaceManager);
const contextBuilder = createContextBuilder(toolGateway);
const llmClient = process.env.DOUBAO_API_KEY && process.env.DOUBAO_MODEL ? createDoubaoClient() : null;
const agentCore = createAgentCore(contextBuilder, toolGateway, llmClient);

await workspaceManager.loadFromDisk();

export function startRuntimeServer() {
  const server = createServer(async (req, res) => {
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
      sendJson(res, 200, { tree: workspaceManager.listTree() });
      return;
    }

    if (url.pathname.startsWith('/api/file/') && req.method === 'GET') {
      const filePath = decodeURIComponent(url.pathname.replace('/api/file/', ''));
      const file = toolGateway.readFile(filePath);
      if (!file) {
        sendJson(res, 404, { error: 'File not found' });
        return;
      }
      sendJson(res, 200, file);
      return;
    }

    if (url.pathname === '/api/file' && req.method === 'PUT') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const parsed = body ? JSON.parse(body) : {};
      const updated = await agentCore.writeFile(parsed.path, parsed.content ?? '');
      sendJson(res, 200, { ok: true, file: updated.file, tree: updated.tree, action: updated.action });
      return;
    }

    if (url.pathname === '/api/folder' && req.method === 'PUT') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const parsed = body ? JSON.parse(body) : {};
      const created = await workspaceManager.createFolder(parsed.path ?? '');
      sendJson(res, 200, created);
      return;
    }

    if (url.pathname === '/api/item/rename' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const parsed = body ? JSON.parse(body) : {};
      const renamed = await workspaceManager.renameItem(parsed.path ?? '', parsed.nextName ?? '');
      sendJson(res, 200, renamed);
      return;
    }

    if (url.pathname === '/api/item/delete' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const parsed = body ? JSON.parse(body) : {};
      const deleted = await workspaceManager.deleteItem(parsed.path ?? '');
      sendJson(res, 200, deleted);
      return;
    }

    if (url.pathname === '/api/tool/run' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const parsed = body ? JSON.parse(body) : {};
      const result = await agentCore.runCommand(parsed.command ?? '');
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/api/agent/preview' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const parsed = body ? JSON.parse(body) : {};

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });

      const writeEvent = (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      try {
        const result = await agentCore.preview(parsed.prompt ?? '', parsed.selectedFile ?? null, (chunk) => {
          if (typeof chunk === 'string') {
            writeEvent({ type: 'chunk', chunk });
            return;
          }
          writeEvent(chunk);
        });
        writeEvent({ type: 'result', result });
      } catch (error) {
        writeEvent({ type: 'error', message: error.message });
      }

      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = join(publicDir, pathname);

    try {
      const content = await readFile(filePath);
      const type = mimeTypes[extname(filePath)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(content);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    console.log(`AI Coding Agent Web MVP running at http://localhost:${port}`);
  });
}
