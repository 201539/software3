declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};

declare module 'node:fs' {
  export const promises: {
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    readFile(path: string, options?: string): Promise<string>;
    writeFile(path: string, data: string, options?: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
    stat(path: string): Promise<{ isDirectory(): boolean }>;
  };
}

declare module 'fs' {
  export const promises: typeof import('node:fs').promises;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
}

declare module 'path' {
  export function dirname(path: string): string;
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
}

declare module 'child_process' {
  export function execFile(
    file: string,
    args: string[],
    options: { cwd?: string },
    callback: (error: unknown, stdout: string, stderr: string) => void,
  ): void;
}

declare module 'node:child_process' {
  export { execFile } from 'child_process';
}
