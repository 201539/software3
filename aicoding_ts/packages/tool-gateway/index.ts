import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { TreeNode, WorkspaceFile } from '../workspace-manager/index.ts';

type WorkspaceManager = {
  rootDir: string;
  getRootDir: () => string;
  findFile: (path: string) => WorkspaceFile | null;
  updateFile: (path: string, content: string) => Promise<unknown>;
  listTree: () => TreeNode[];
  listFiles: () => WorkspaceFile[];
};

function splitCommand(command: string): string[] {
  const parts = command.trim().split(/\s+/);
  return [parts[0], ...parts.slice(1)];
}

export function createToolGateway(workspaceManager: WorkspaceManager) {
  return {
    async readFile(path: string): Promise<WorkspaceFile | null> {
      const rootDir = workspaceManager.getRootDir();
      const absPath = resolve(join(rootDir, path));
      if (!absPath.startsWith(resolve(rootDir))) return null;
      try {
        const content = await readFile(absPath, 'utf8');
        return { path, content };
      } catch {
        return null;
      }
    },
    async writeFile(path: string, content: string) {
      return workspaceManager.updateFile(path, content);
    },
    listWorkspace(): WorkspaceFile[] {
      return workspaceManager.listFiles();
    },
    async runCommand(command: string) {
      return new Promise((resolve) => {
        const [cmd, ...args] = splitCommand(command);
        execFile(cmd, args, { cwd: workspaceManager.getRootDir() }, (error: unknown, stdout: string, stderr: string) => {
          resolve({
            command,
            status: error ? 'failed' : 'success',
            code: error && typeof error === 'object' && 'code' in error ? Number((error as { code?: number }).code ?? 0) : 0,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          });
        });
      });
    },
  };
}
