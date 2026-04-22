import { execFile } from 'node:child_process';

function splitCommand(command) {
  const parts = command.trim().split(/\s+/);
  return [parts[0], ...parts.slice(1)];
}

export function createToolGateway(workspaceManager) {
  return {
    readFile(path) {
      return workspaceManager.findFile(path);
    },
    async writeFile(path, content) {
      return workspaceManager.updateFile(path, content);
    },
    listWorkspace() {
      return workspaceManager.listTree();
    },
    async runCommand(command) {
      return new Promise((resolve) => {
        const [cmd, ...args] = splitCommand(command);
        execFile(cmd, args, { cwd: workspaceManager.rootDir }, (error, stdout, stderr) => {
          resolve({
            command,
            status: error ? 'failed' : 'success',
            code: error?.code ?? 0,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          });
        });
      });
    },
  };
}
