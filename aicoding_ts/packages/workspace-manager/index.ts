import { promises as fs } from 'node:fs';
import { DEFAULT_PROJECT_ID } from '../shared/index.ts';

export type WorkspaceSearchHit = {
  path: string;
  line: number;
  column: number;
  snippet: string;
};

export type PatchFileResult = {
  ok: boolean;
  action: 'patched' | 'patch_failed';
  file?: WorkspaceFile;
  tree?: TreeNode[];
  diff?: { beforeLines: number; afterLines: number; replacements: number };
  error?: string;
};

export type TreeNode = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  content?: string;
  children?: TreeNode[];
  path?: string;
};

export type WorkspaceFile = {
  path: string;
  content?: string;
};

function createDefaultTree(): TreeNode[] {
  return [];
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitLines(content: string) {
  return content.split(/\r?\n/);
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```(?:diff|patch|text)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function parseUnifiedDiff(patchText: string) {
  const lines = patchText.split(/\r?\n/);
  const hunks: Array<{ before: string[]; after: string[] }> = [];
  let currentBefore: string[] = [];
  let currentAfter: string[] = [];
  let mode: 'before' | 'after' | null = null;

  const flush = () => {
    if (currentBefore.length || currentAfter.length) {
      hunks.push({ before: currentBefore, after: currentAfter });
      currentBefore = [];
      currentAfter = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith('@@') || line.startsWith('*** ') || line.startsWith('--- ') || line.startsWith('+++ ')) continue;
    if (line.startsWith('-')) {
      if (mode === 'after') flush();
      mode = 'before';
      currentBefore.push(line.slice(1));
      continue;
    }
    if (line.startsWith('+')) {
      mode = 'after';
      currentAfter.push(line.slice(1));
      continue;
    }
    if (!line.trim()) {
      if (mode) {
        currentBefore.push('');
        currentAfter.push('');
      }
      continue;
    }
  }

  flush();
  return hunks.filter((hunk) => hunk.before.length || hunk.after.length);
}

function flattenTree(nodes: TreeNode[], prefix = ''): WorkspaceFile[] {
  return nodes.flatMap((node) => {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'folder') return flattenTree(node.children ?? [], path);
    return [{ path, content: node.content }];
  });
}

function attachChildrenPath(node: TreeNode, parentPath = ''): TreeNode {
  const path = parentPath ? `${parentPath}/${node.name}` : node.name;
  if (node.type === 'folder') {
    return {
      ...node,
      path,
      children: (node.children ?? []).map((child) => attachChildrenPath(child, path)),
    };
  }
  return { ...node, path };
}

function upsertNode(nodes: TreeNode[], segments: string[], content: string): TreeNode[] {
  const [head, ...rest] = segments;
  const index = nodes.findIndex((node) => node.name === head);

  if (rest.length === 0) {
    const fileNode: TreeNode = { id: `file-${segments.join('-')}`, name: head, type: 'file', content };
    if (index >= 0) {
      const existing = nodes[index];
      const next = [...nodes];
      next[index] = { ...existing, type: 'file', content };
      return next;
    }
    return [...nodes, fileNode];
  }

  let folderNode: TreeNode;
  if (index >= 0 && nodes[index].type === 'folder') {
    folderNode = nodes[index];
  } else if (index >= 0) {
    folderNode = { ...nodes[index], type: 'folder', children: [] };
  } else {
    folderNode = { id: `folder-${head}`, name: head, type: 'folder', children: [] };
  }

  const updatedFolder: TreeNode = {
    ...folderNode,
    children: upsertNode(folderNode.children ?? [], rest, content),
  };

  if (index >= 0) {
    const next = [...nodes];
    next[index] = updatedFolder;
    return next;
  }
  return [...nodes, updatedFolder];
}

function removeNode(nodes: TreeNode[], segments: string[]): TreeNode[] {
  const [head, ...rest] = segments;
  const index = nodes.findIndex((node) => node.name === head);
  if (index < 0) return nodes;
  if (rest.length === 0) {
    return nodes.filter((_, i) => i !== index);
  }

  const node = nodes[index];
  if (node.type !== 'folder') return nodes;
  const updated: TreeNode = {
    ...node,
    children: removeNode(node.children ?? [], rest),
  };
  const next = [...nodes];
  next[index] = updated;
  return next;
}

function renameNode(nodes: TreeNode[], segments: string[], nextName: string): TreeNode[] {
  const [head, ...rest] = segments;
  const index = nodes.findIndex((node) => node.name === head);
  if (index < 0) return nodes;

  if (rest.length === 0) {
    const node = nodes[index];
    const next = [...nodes];
    next[index] = { ...node, name: nextName };
    return next;
  }

  const node = nodes[index];
  if (node.type !== 'folder') return nodes;
  const updated: TreeNode = {
    ...node,
    children: renameNode(node.children ?? [], rest, nextName),
  };
  const next = [...nodes];
  next[index] = updated;
  return next;
}

export function createWorkspaceManager(options: { projectId?: string; rootDir?: string; initialTree?: TreeNode[] } = {}) {
  const projectId = options.projectId ?? DEFAULT_PROJECT_ID;
  const rootDir = options.rootDir ?? `${process.cwd()}/workspaces/${projectId}/workspace`;

  function resolveWorkspacePath(...parts: string[]) {
    return [rootDir, ...parts.filter(Boolean)].join('/').replace(/\/+/g, '/');
  }
  const state = {
    tree: options.initialTree ?? createDefaultTree(),
    rootDir,
  };

  async function ensureWorkspaceDir() {
    await fs.mkdir(state.rootDir, { recursive: true });
  }

  async function ensureDirectoryNode(dirPath: string) {
    const normalized = normalizePath(dirPath);
    const absolute = `${state.rootDir}/${normalized}`;
    await fs.mkdir(absolute, { recursive: true });
  }

  function listTree(): TreeNode[] {
    return state.tree.map((node) => attachChildrenPath(node));
  }

  function listFiles(): WorkspaceFile[] {
    return flattenTree(state.tree);
  }

  function findFile(path: string): WorkspaceFile | null {
    const normalized = normalizePath(path);
    return listFiles().find((item) => item.path === normalized) ?? null;
  }

  function searchInWorkspace(query: string, path?: string): WorkspaceSearchHit[] {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    const escaped = escapeRegExp(normalizedQuery);
    const matcher = new RegExp(escaped, 'gi');
    const normalizedPath = path ? normalizePath(path) : '';
    const files = path ? listFiles().filter((file) => file.path === normalizedPath || file.path.startsWith(`${normalizedPath}/`)) : listFiles();
    const hits: WorkspaceSearchHit[] = [];

    for (const file of files) {
      const lines = splitLines(String(file.content ?? ''));
      lines.forEach((line, index) => {
        matcher.lastIndex = 0;
        if (!matcher.test(line)) return;
        const matchIndex = line.toLowerCase().indexOf(normalizedQuery.toLowerCase());
        const column = Math.max(1, matchIndex + 1);
        hits.push({
          path: file.path,
          line: index + 1,
          column,
          snippet: line.trim(),
        });
      });
    }

    return hits;
  }

  async function patchFile(path: string, patch: string): Promise<PatchFileResult> {
    const normalized = normalizePath(path);
    const file = findFile(normalized);
    if (!file) return { ok: false, action: 'patch_failed', error: `File not found: ${normalized}` };

    const before = String(file.content ?? '');
    const beforeLines = splitLines(before).length;
    const patchText = stripCodeFence(String(patch ?? '').trim());
    if (!patchText) return { ok: false, action: 'patch_failed', error: 'Patch content is empty' };

    const applyReplacement = (source: string, beforeBlock: string, afterBlock: string) => {
      const exactIndex = source.indexOf(beforeBlock);
      if (exactIndex >= 0) {
        return {
          content: source.slice(0, exactIndex) + afterBlock + source.slice(exactIndex + beforeBlock.length),
          replaced: true,
        };
      }

      const fuzzyPattern = new RegExp(escapeRegExp(beforeBlock).replace(/\s+/g, '[\\s\\S]+?'), 'm');
      if (!fuzzyPattern.test(source)) return { content: source, replaced: false };
      return { content: source.replace(fuzzyPattern, afterBlock), replaced: true };
    };

    const applyLineReplacement = (source: string, searchLine: string, replaceLine: string) => {
      const lines = splitLines(source);
      const normalizedSearch = searchLine.trim();
      const index = lines.findIndex((line) => line.trim() === normalizedSearch || line.includes(normalizedSearch));
      if (index < 0) return { content: source, replaced: false };
      lines[index] = replaceLine;
      return { content: lines.join('\n'), replaced: true };
    };

    const applyBlockDiff = (source: string, hunks: Array<{ before: string[]; after: string[] }>) => {
      let next = source;
      let replacedAny = false;
      for (const hunk of hunks) {
        const beforeBlock = hunk.before.join('\n').trim();
        const afterBlock = hunk.after.join('\n').trim();
        if (!beforeBlock && !afterBlock) continue;
        const result = applyReplacement(next, beforeBlock, afterBlock);
        if (!result.replaced) return { content: source, replaced: false };
        next = result.content;
        replacedAny = true;
      }
      return { content: next, replaced: replacedAny };
    };

    let after = before;
    let replacements = 0;

    if (patchText.includes('@@') && (patchText.includes('+') || patchText.includes('-'))) {
      const hunks = parseUnifiedDiff(patchText);
      const result = applyBlockDiff(after, hunks);
      if (!result.replaced) return { ok: false, action: 'patch_failed', error: `Patch target not found in ${normalized}` };
      after = result.content;
      replacements = hunks.length;
    } else {
      const replacementBlocks = patchText
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean);

      for (const block of replacementBlocks) {
        let beforeBlock = '';
        let afterBlock = '';

        if (block.includes('\n---\n')) {
          [beforeBlock, afterBlock] = block.split(/\n---\n/);
        } else if (block.includes('=>')) {
          const [left, right] = block.split(/\s*=>\s*/);
          beforeBlock = left ?? '';
          afterBlock = right ?? '';
        } else if (block.includes('\n')) {
          const [left, right] = block.split(/\n/);
          beforeBlock = left ?? '';
          afterBlock = right ?? '';
        } else {
          return { ok: false, action: 'patch_failed', error: 'Invalid patch format. Use unified diff, "before\n---\nafter", or "before => after".' };
        }

        if (!beforeBlock.trim()) return { ok: false, action: 'patch_failed', error: 'Patch before block is empty' };
        if (!afterBlock.trim()) return { ok: false, action: 'patch_failed', error: 'Patch after block is empty' };

        const lineResult = applyLineReplacement(after, beforeBlock, afterBlock);
        const blockResult = lineResult.replaced ? lineResult : applyReplacement(after, beforeBlock.trim(), afterBlock.trim());
        if (!blockResult.replaced) return { ok: false, action: 'patch_failed', error: `Patch target not found in ${normalized}` };
        after = blockResult.content;
        replacements += 1;
      }
    }

    state.tree = upsertNode(state.tree, normalized.split('/').filter(Boolean), after);
    const filePath = `${state.rootDir}/${normalized}`;
    const dirPath = filePath.slice(0, filePath.lastIndexOf('/'));
    if (dirPath) await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(filePath, after, 'utf8');

    return {
      ok: true,
      action: 'patched',
      file: { path: normalized, content: after },
      tree: listTree(),
      diff: { beforeLines, afterLines: splitLines(after).length, replacements },
    };
  }

  async function updateFile(path: string, content: string) {
    await ensureWorkspaceDir();
    const normalized = normalizePath(path);
    const segments = normalized.split('/').filter(Boolean);
    const existedBefore = Boolean(findFile(normalized));
    state.tree = upsertNode(state.tree, segments, content);

    const filePath = resolveWorkspacePath(normalized);
    const dir = filePath.slice(0, filePath.lastIndexOf('/'));
    if (dir) await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');

    return {
      ok: true,
      action: existedBefore ? 'updated' : 'created',
      file: {
        path: normalized,
        content,
      },
      tree: listTree(),
    };
  }

  async function createFolder(path: string) {
    await ensureWorkspaceDir();
    const normalized = normalizePath(path);
    await ensureDirectoryNode(normalized);

    const segments = normalized.split('/').filter(Boolean);
    state.tree = upsertNode(state.tree, [...segments, '.folder-marker'], '');
    state.tree = removeNode(state.tree, [...segments, '.folder-marker']);

    return {
      ok: true,
      action: 'created',
      folder: { path: normalized },
      tree: listTree(),
    };
  }

  async function renameItem(path: string, nextName: string) {
    await ensureWorkspaceDir();
    const normalized = normalizePath(path);
    const segments = normalized.split('/').filter(Boolean);
    const parentPath = segments.slice(0, -1).join('/');
    const oldAbsolute = resolveWorkspacePath(normalized);
    const nextPath = parentPath ? `${parentPath}/${nextName}` : nextName;
    const nextAbsolute = `${state.rootDir}/${nextPath}`;

    const nextDir = nextAbsolute.slice(0, nextAbsolute.lastIndexOf('/'));
    if (nextDir) await fs.mkdir(nextDir, { recursive: true });
    await fs.rename(oldAbsolute, nextAbsolute);

    state.tree = renameNode(state.tree, segments, nextName);

    return {
      ok: true,
      action: 'renamed',
      from: { path: normalized },
      to: { path: nextPath },
      tree: listTree(),
    };
  }

  async function deleteItem(path: string) {
    await ensureWorkspaceDir();
    const normalized = normalizePath(path);
    const segments = normalized.split('/').filter(Boolean);
    const absolute = resolveWorkspacePath(normalized);
    const stats = await fs.stat(absolute);

    if (stats.isDirectory()) {
      await fs.rm(absolute, { recursive: true, force: true });
      state.tree = removeNode(state.tree, segments);
      return {
        ok: true,
        action: 'deleted',
        target: { path: normalized, type: 'folder' },
        tree: listTree(),
      };
    }

    await fs.rm(absolute, { force: true });
    state.tree = removeNode(state.tree, segments);
    return {
      ok: true,
      action: 'deleted',
      target: { path: normalized, type: 'file' },
      tree: listTree(),
    };
  }

  async function loadFromDisk() {
    await ensureWorkspaceDir();
    const files = listFiles();

    for (const file of files) {
      const filePath = `${state.rootDir}/${file.path}`;
      try {
        const content = await fs.readFile(filePath, 'utf8');
        file.content = content;
      } catch {
        const dir = filePath.slice(0, filePath.lastIndexOf('/'));
        if (dir) await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, file.content ?? '', 'utf8');
      }
    }

    return state.tree;
  }

  return {
    projectId,
    rootDir,
    listTree,
    listFiles,
    findFile,
    searchInWorkspace,
    patchFile,
    updateFile,
    createFolder,
    renameItem,
    deleteItem,
    loadFromDisk,
  };
}
