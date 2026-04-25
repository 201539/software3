import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_PROJECT_ID } from '../shared/index.ts';
import type { Session, TaskSummary, ChatMessage } from '../shared/types.ts';

export type { Session, TaskSummary, ChatMessage };

export function createSessionStore(options: { projectId?: string } = {}) {
  const projectId = options.projectId ?? DEFAULT_PROJECT_ID;
  const sessionsDir = join(process.cwd(), 'workspaces', projectId, 'sessions');
  const currentFile = join(sessionsDir, 'current.json');
  const memoryFile = join(process.cwd(), 'workspaces', projectId, 'project-memory.md');

  async function ensureDir() {
    await mkdir(sessionsDir, { recursive: true });
  }

  function sessionPath(sessionId: string) {
    return join(sessionsDir, `${sessionId}.json`);
  }

  async function getCurrentSessionId(): Promise<string | null> {
    try {
      const raw = await readFile(currentFile, 'utf8');
      const data = JSON.parse(raw) as { currentSessionId?: string };
      return data.currentSessionId ?? null;
    } catch {
      return null;
    }
  }

  async function setCurrentSessionId(sessionId: string) {
    await ensureDir();
    await writeFile(currentFile, JSON.stringify({ currentSessionId: sessionId }, null, 2), 'utf8');
  }

  async function loadSession(sessionId: string): Promise<Session | null> {
    try {
      const raw = await readFile(sessionPath(sessionId), 'utf8');
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }

  async function saveSession(session: Session): Promise<Session> {
    await ensureDir();
    const updated: Session = { ...session, updatedAt: new Date().toISOString() };
    await writeFile(sessionPath(session.sessionId), JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  }

  async function createSession(): Promise<Session> {
    const sessionId = `session-${Date.now()}`;
    const session: Session = {
      sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      taskSummaries: [],
      activeTaskId: null,
    };
    await saveSession(session);
    await setCurrentSessionId(sessionId);
    return session;
  }

  async function getOrCreateCurrentSession(): Promise<Session> {
    const currentId = await getCurrentSessionId();
    if (currentId) {
      const existing = await loadSession(currentId);
      if (existing) return existing;
    }
    return createSession();
  }

  async function appendMessages(sessionId: string, newMessages: ChatMessage[]): Promise<Session> {
    const session = await loadSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    return saveSession({ ...session, messages: [...session.messages, ...newMessages] });
  }

  async function appendTaskSummary(sessionId: string, summary: TaskSummary): Promise<Session> {
    const session = await loadSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    return saveSession({ ...session, taskSummaries: [...session.taskSummaries, summary] });
  }

  async function readProjectMemory(): Promise<string> {
    try {
      return await readFile(memoryFile, 'utf8');
    } catch {
      return '';
    }
  }

  return {
    sessionsDir,
    getCurrentSessionId,
    setCurrentSessionId,
    createSession,
    loadSession,
    saveSession,
    getOrCreateCurrentSession,
    appendMessages,
    appendTaskSummary,
    readProjectMemory,
  };
}
