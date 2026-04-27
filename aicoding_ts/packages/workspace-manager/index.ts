import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { DEFAULT_PROJECT_ID } from '../shared/index.ts';

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
  const rootDir = options.rootDir ?? join(process.cwd(), 'workspaces', projectId, 'workspace');
  const state = {
    tree: options.initialTree ?? createDefaultTree(),
    rootDir,
  };

  async function ensureWorkspaceDir() {
    await mkdir(state.rootDir, { recursive: true });
  }

  async function ensureDirectoryNode(dirPath: string) {
    const normalized = normalizePath(dirPath);
    const absolute = resolve(state.rootDir, normalized);
    await mkdir(absolute, { recursive: true });
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

  async function updateFile(path: string, content: string) {
    await ensureWorkspaceDir();
    const normalized = normalizePath(path);
    const segments = normalized.split('/').filter(Boolean);
    const existedBefore = Boolean(findFile(normalized));
    state.tree = upsertNode(state.tree, segments, content);

    const filePath = resolve(state.rootDir, normalized);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');

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
    const oldAbsolute = resolve(state.rootDir, normalized);
    const nextPath = parentPath ? `${parentPath}/${nextName}` : nextName;
    const nextAbsolute = resolve(state.rootDir, nextPath);

    await mkdir(dirname(nextAbsolute), { recursive: true });
    await rename(oldAbsolute, nextAbsolute);

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
    const absolute = resolve(state.rootDir, normalized);
    const stats = await stat(absolute);

    if (stats.isDirectory()) {
      await rm(absolute, { recursive: true, force: true });
      state.tree = removeNode(state.tree, segments);
      return {
        ok: true,
        action: 'deleted',
        target: { path: normalized, type: 'folder' },
        tree: listTree(),
      };
    }

    await rm(absolute, { force: true });
    state.tree = removeNode(state.tree, segments);
    return {
      ok: true,
      action: 'deleted',
      target: { path: normalized, type: 'file' },
      tree: listTree(),
    };
  }

  const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', 'dist', '__pycache__', '.cache', 'vendor', '.yarn', 'build', 'coverage', '.next', '.nuxt', 'out']);
  const MAX_SCAN_DEPTH = 6;

  async function scanDir(dir: string, depth = 0): Promise<TreeNode[]> {
    if (depth > MAX_SCAN_DEPTH) return [];
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const nodes: TreeNode[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        nodes.push({
          id: `folder-${entry.name}`,
          name: entry.name,
          type: 'folder',
          children: await scanDir(fullPath, depth + 1),
        });
      } else {
        nodes.push({ id: `file-${entry.name}`, name: entry.name, type: 'file' });
      }
    }
    return nodes;
  }

  async function loadFromDisk() {
    await ensureWorkspaceDir();
    state.tree = await scanDir(state.rootDir);
    return state.tree;
  }

  function getRootDir(): string {
    return state.rootDir;
  }

  async function switchRoot(newRootDir: string): Promise<TreeNode[]> {
    const resolved = resolve(newRootDir);
    const info = await stat(resolved);
    if (!info.isDirectory()) throw new Error(`不是目录：${resolved}`);
    state.rootDir = resolved;
    state.tree = [];
    state.tree = await scanDir(state.rootDir);
    return state.tree;
  }

  return {
    projectId,
    rootDir,
    getRootDir,
    switchRoot,
    listTree,
    listFiles,
    findFile,
    updateFile,
    createFolder,
    renameItem,
    deleteItem,
    loadFromDisk,
  };
}
