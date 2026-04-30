const chatLog = document.querySelector<HTMLElement>('#chatLog')!;
const chatForm = document.querySelector<HTMLFormElement>('#chatForm')!;
const promptInput = document.querySelector<HTMLTextAreaElement>('#promptInput')!;
const fileTree = document.querySelector<HTMLElement>('#fileTree')!;
const editor = document.querySelector<HTMLTextAreaElement>('#editor')!;
const currentFile = document.querySelector<HTMLElement>('#currentFile')!;
const summary = document.querySelector<HTMLElement>('#summary')!;
const refreshBtn = document.querySelector<HTMLButtonElement>('#refreshBtn')!;
const workspaceLayout = document.querySelector<HTMLElement>('#workspaceLayout')!;
const newItemBtn = document.querySelector<HTMLButtonElement>('#newItemBtn')!;
const newItemMenu = document.querySelector<HTMLElement>('#newItemMenu');

type WorkspaceNode = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  content?: string;
  children?: WorkspaceNode[];
  path?: string;
};

type ToolEvent = {
  type: 'tool';
  tool: string;
  summary?: string;
  detail?: string;
};

type PreviewResult = {
  output?: string;
  toolResults?: Array<{ name: string; result?: { ok?: boolean; file?: unknown } }>;
  data?: { toolResults?: Array<{ name: string; result?: { ok?: boolean; file?: unknown } }> };
};

let selectedFile: string | null = null;
let currentFileContent = '';
let workspaceCache: WorkspaceNode[] = [];
let currentAutoRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let editorSaveTimer: ReturnType<typeof setTimeout> | null = null;
let expandedFolders = new Set<string>();

const layoutState = {
  chat: 34,
  editor: 40,
  tree: 26,
};
const layoutLimits = {
  chat: { min: 22, max: 55 },
  editor: { min: 30, max: 60 },
  tree: { min: 18, max: 40 },
};

function loadLayoutState() {
  try {
    const stored = localStorage.getItem('layoutState');
    if (!stored) return;
    const parsed = JSON.parse(stored) as Partial<typeof layoutState>;
    Object.assign(layoutState, parsed);
  } catch {
    // ignore
  }
}

function persistLayoutState() {
  localStorage.setItem('layoutState', JSON.stringify(layoutState));
}

function applyLayoutWidths() {
  workspaceLayout.style.gridTemplateColumns = `${layoutState.chat}% 2px ${layoutState.editor}% 2px ${layoutState.tree}%`;
}

function clampLayoutState() {
  const total = layoutState.chat + layoutState.editor + layoutState.tree;
  const normalized = total === 100 ? layoutState : {
    chat: (layoutState.chat / total) * 100,
    editor: (layoutState.editor / total) * 100,
    tree: (layoutState.tree / total) * 100,
  };
  layoutState.chat = normalized.chat;
  layoutState.editor = normalized.editor;
  layoutState.tree = normalized.tree;
}

function adjustLayout(delta: number, leftPanel: keyof typeof layoutState, rightPanel: keyof typeof layoutState) {
  const totalWidth = workspaceLayout.getBoundingClientRect().width;
  if (!totalWidth) return;
  const deltaPercent = (delta / totalWidth) * 100;

  const nextLeft = layoutState[leftPanel] + deltaPercent;
  const nextRight = layoutState[rightPanel] - deltaPercent;

  const leftLimits = layoutLimits[leftPanel];
  const rightLimits = layoutLimits[rightPanel];

  if (nextLeft < leftLimits.min || nextLeft > leftLimits.max) return;
  if (nextRight < rightLimits.min || nextRight > rightLimits.max) return;

  layoutState[leftPanel] = nextLeft;
  layoutState[rightPanel] = nextRight;
  clampLayoutState();
  applyLayoutWidths();
  persistLayoutState();
}

function initResizers() {
  const resizers = document.querySelectorAll<HTMLElement>('.panel-resizer');
  resizers.forEach((resizer) => {
    const kind = resizer.dataset.resizer;
    let active = false;
    let startX = 0;

    const onMove = (event: MouseEvent) => {
      if (!active) return;
      const delta = event.clientX - startX;
      startX = event.clientX;
      if (kind === 'chat-editor') {
        adjustLayout(delta, 'chat', 'editor');
      } else if (kind === 'editor-tree') {
        adjustLayout(delta, 'editor', 'tree');
      }
    };

    const stop = () => {
      if (!active) return;
      active = false;
      resizer.classList.remove('active');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', stop);
    };

    resizer.addEventListener('mousedown', (event) => {
      event.preventDefault();
      active = true;
      startX = event.clientX;
      resizer.classList.add('active');
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', stop);
    });
  });
}

function loadExpandedFolders() {
  try {
    const stored = localStorage.getItem('expandedFolders');
    if (!stored) return;
    expandedFolders = new Set(JSON.parse(stored) as string[]);
  } catch {
    expandedFolders = new Set();
  }
}

function persistExpandedFolders() {
  localStorage.setItem('expandedFolders', JSON.stringify([...expandedFolders]));
}

function appendMessage(role: string, text: string) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

function isFolder(node: WorkspaceNode) {
  return node.type === 'folder';
}

function ensureContextMenu() {
  let menu = document.querySelector<HTMLElement>('#treeContextMenu');
  if (menu) return menu;

  menu = document.createElement('div');
  menu.id = 'treeContextMenu';
  menu.className = 'tree-context-menu';
  menu.innerHTML = `
    <button type="button" data-action="new-file">新建文件</button>
    <button type="button" data-action="new-folder">新建文件夹</button>
    <button type="button" data-action="rename">重命名</button>
    <button type="button" data-action="delete">删除</button>
  `;
  document.body.appendChild(menu);
  return menu;
}

function hideContextMenu() {
  const menu = document.querySelector<HTMLElement>('#treeContextMenu');
  if (menu) menu.classList.remove('visible');
}

function hideNewItemMenu() {
  if (newItemMenu) {
    newItemMenu.classList.remove('visible');
    newItemMenu.setAttribute('aria-hidden', 'true');
  }
}

function toggleNewItemMenu() {
  if (!newItemMenu) return;
  const visible = newItemMenu.classList.contains('visible');
  if (visible) {
    hideNewItemMenu();
  } else {
    newItemMenu.classList.add('visible');
    newItemMenu.setAttribute('aria-hidden', 'false');
  }
}

function showConfirmDialog({ title, message, confirmLabel = '确认', danger = false }: { title: string; message: string; confirmLabel?: string; danger?: boolean }) {
  return new Promise<boolean>((resolve) => {
    let dialog = document.querySelector<HTMLElement>('#treeConfirmDialog');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'treeConfirmDialog';
      dialog.className = 'tree-dialog-overlay';
      dialog.innerHTML = `
        <div class="tree-dialog">
          <h3 data-role="title"></h3>
          <p data-role="message"></p>
          <div class="tree-dialog-actions">
            <button type="button" data-role="cancel">取消</button>
            <button type="button" data-role="confirm"></button>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);
    }

    dialog.querySelector<HTMLElement>('[data-role="title"]')!.textContent = title;
    dialog.querySelector<HTMLElement>('[data-role="message"]')!.textContent = message;
    const confirmBtn = dialog.querySelector<HTMLButtonElement>('[data-role="confirm"]')!;
    confirmBtn.textContent = confirmLabel;
    confirmBtn.classList.toggle('danger', danger);

    const cleanup = () => {
      dialog!.classList.remove('visible');
      confirmBtn.onclick = null;
      dialog!.querySelector<HTMLButtonElement>('[data-role="cancel"]')!.onclick = null;
    };

    dialog.classList.add('visible');

    dialog.querySelector<HTMLButtonElement>('[data-role="cancel"]')!.onclick = () => {
      cleanup();
      resolve(false);
    };

    confirmBtn.onclick = () => {
      cleanup();
      resolve(true);
    };
  });
}

function showRenameDialog(currentPath: string) {
  return new Promise<string | null>((resolve) => {
    let dialog = document.querySelector<HTMLElement>('#treeRenameDialog');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'treeRenameDialog';
      dialog.className = 'tree-dialog-overlay';
      dialog.innerHTML = `
        <div class="tree-dialog">
          <h3>重命名</h3>
          <p data-role="message"></p>
          <input data-role="input" type="text" />
          <div class="tree-dialog-actions">
            <button type="button" data-role="cancel">取消</button>
            <button type="button" data-role="confirm">重命名</button>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);
    }

    dialog.querySelector<HTMLElement>('[data-role="message"]')!.textContent = `当前名称：${currentPath}`;
    const input = dialog.querySelector<HTMLInputElement>('[data-role="input"]')!;
    input.value = currentPath.split('/').pop() || currentPath;

    const cleanup = () => {
      dialog!.classList.remove('visible');
      dialog!.querySelector<HTMLButtonElement>('[data-role="confirm"]')!.onclick = null;
      dialog!.querySelector<HTMLButtonElement>('[data-role="cancel"]')!.onclick = null;
    };

    dialog.classList.add('visible');
    input.focus();
    input.select();

    dialog.querySelector<HTMLButtonElement>('[data-role="cancel"]')!.onclick = () => {
      cleanup();
      resolve(null);
    };

    dialog.querySelector<HTMLButtonElement>('[data-role="confirm"]')!.onclick = () => {
      const value = input.value.trim();
      cleanup();
      resolve(value || null);
    };
  });
}

function saveCurrentFile() {
  if (!selectedFile) return;
  const content = editor.value;
  if (content === currentFileContent) return;

  if (editorSaveTimer) clearTimeout(editorSaveTimer);
  editorSaveTimer = setTimeout(async () => {
    const res = await fetch('/api/file', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: selectedFile, content: editor.value }),
    });
    const data = await res.json();
    currentFileContent = editor.value;
    workspaceCache = data.tree || workspaceCache;
    renderTree(workspaceCache);
    scheduleWorkspaceRefresh(0);
  }, 300);
}

function showCreateNameDialog(kind: 'file' | 'folder') {
  return new Promise<string | null>((resolve) => {
    let dialog = document.querySelector<HTMLElement>('#treeCreateNameDialog');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'treeCreateNameDialog';
      dialog.className = 'tree-dialog-overlay';
      dialog.innerHTML = `
        <div class="tree-dialog">
          <h3 data-role="title"></h3>
          <p data-role="message"></p>
          <input data-role="input" type="text" />
          <div class="tree-dialog-actions">
            <button type="button" data-role="cancel">取消</button>
            <button type="button" data-role="confirm">确认</button>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);
    }

    dialog.querySelector<HTMLElement>('[data-role="title"]')!.textContent = kind === 'file' ? '新建文件' : '新建文件夹';
    dialog.querySelector<HTMLElement>('[data-role="message"]')!.textContent = kind === 'file' ? '请输入文件名' : '请输入文件夹名';
    const input = dialog.querySelector<HTMLInputElement>('[data-role="input"]')!;
    input.value = '';

    const cleanup = () => {
      dialog!.classList.remove('visible');
      dialog!.querySelector<HTMLButtonElement>('[data-role="confirm"]')!.onclick = null;
      dialog!.querySelector<HTMLButtonElement>('[data-role="cancel"]')!.onclick = null;
    };

    dialog.classList.add('visible');
    input.focus();

    dialog.querySelector<HTMLButtonElement>('[data-role="cancel"]')!.onclick = () => {
      cleanup();
      resolve(null);
    };

    dialog.querySelector<HTMLButtonElement>('[data-role="confirm"]')!.onclick = () => {
      const value = input.value.trim();
      cleanup();
      resolve(value || null);
    };
  });
}

async function createWorkspaceItem(kind: 'file' | 'folder', basePath = '') {
  const name = await showCreateNameDialog(kind);
  if (!name) return;

  if (kind === 'file') {
    const path = basePath ? `${basePath}/${name}` : name;
    const res = await fetch('/api/file', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content: '' }),
    });
    const data = await res.json();
    workspaceCache = data.tree || workspaceCache;
    renderTree(workspaceCache);
    scheduleWorkspaceRefresh(0);
    return;
  }

  const path = basePath ? `${basePath}/${name}` : name;
  const res = await fetch('/api/folder', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  const data = await res.json();
  workspaceCache = data.tree || workspaceCache;
  renderTree(workspaceCache);
  scheduleWorkspaceRefresh(0);
}

async function renameWorkspaceItem(path: string) {
  const nextName = await showRenameDialog(path);
  if (!nextName) return;

  const res = await fetch('/api/item/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, nextName }),
  });
  const data = await res.json();
  workspaceCache = data.tree || workspaceCache;
  if (selectedFile && selectedFile === path) selectedFile = data.to?.path || selectedFile;
  renderTree(workspaceCache);
  scheduleWorkspaceRefresh(0);
}

async function deleteWorkspaceItem(path: string) {
  const confirmed = await showConfirmDialog({
    title: '删除确认',
    message: `确定删除 ${path} 吗？此操作无法撤销。`,
    confirmLabel: '删除',
    danger: true,
  });
  if (!confirmed) return;

  const res = await fetch('/api/item/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  const data = await res.json();
  workspaceCache = data.tree || workspaceCache;
  if (selectedFile === path) {
    selectedFile = null;
    currentFile.textContent = '未打开文件';
    editor.value = '';
    currentFileContent = '';
  }
  renderTree(workspaceCache);
  scheduleWorkspaceRefresh(0);
}

function renderTree(nodes: WorkspaceNode[]) {
  fileTree.innerHTML = '';
  const menu = ensureContextMenu();

  const closeMenuOnScroll = () => hideContextMenu();

  const renderNode = (node: WorkspaceNode, depth = 0, parentPath = '') => {
    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    const row = document.createElement('div');
    row.className = 'file-item';
    row.style.paddingLeft = `${12 + depth * 16}px`;

    if (isFolder(node)) {
      const expanded = expandedFolders.has(fullPath);
      const arrow = expanded ? '▾' : '▸';
      row.innerHTML = `<span class="tree-arrow">${arrow}</span><span class="tree-icon">${expanded ? '📂' : '📁'}</span><span class="tree-label">${node.name}</span>`;
      row.addEventListener('click', () => {
        if (expandedFolders.has(fullPath)) {
          expandedFolders.delete(fullPath);
        } else {
          expandedFolders.add(fullPath);
        }
        persistExpandedFolders();
        renderTree(workspaceCache);
      });
      row.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
        menu.dataset.basePath = fullPath;
        menu.dataset.targetPath = fullPath;
        menu.dataset.targetType = 'folder';
        menu.classList.add('visible');
      });
      fileTree.appendChild(row);

      if (expanded) {
        (node.children || []).forEach((child) => renderNode(child, depth + 1, fullPath));
      }
      return;
    }

    row.innerHTML = `<span class="tree-arrow tree-arrow-spacer"></span><span class="tree-icon">📄</span><span class="tree-label">${node.name}</span>`;
    row.addEventListener('click', () => openFile(fullPath));
    row.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      menu.style.left = `${event.clientX}px`;
      menu.style.top = `${event.clientY}px`;
      menu.dataset.basePath = parentPath;
      menu.dataset.targetPath = fullPath;
      menu.dataset.targetType = 'file';
      menu.classList.add('visible');
    });
    fileTree.appendChild(row);
  };

  nodes.forEach((node) => renderNode(node, 0, ''));

  menu.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.onclick = async () => {
      const action = button.dataset.action;
      const basePath = menu.dataset.basePath || '';
      const targetPath = menu.dataset.targetPath || '';
      hideContextMenu();

      if (action === 'new-file') {
        await createWorkspaceItem('file', basePath);
      } else if (action === 'new-folder') {
        await createWorkspaceItem('folder', basePath);
      } else if (action === 'rename') {
        await renameWorkspaceItem(targetPath);
      } else if (action === 'delete') {
        await deleteWorkspaceItem(targetPath);
      }
    };
  });

  fileTree.removeEventListener('scroll', closeMenuOnScroll);
  fileTree.addEventListener('scroll', closeMenuOnScroll, { once: true });
}

async function loadWorkspace() {
  const res = await fetch('/api/workspace');
  const data = await res.json();
  workspaceCache = data.tree;
  renderTree(workspaceCache);
  updateTreeEmptyState();
}

function scheduleWorkspaceRefresh(delayMs = 0) {
  if (currentAutoRefreshTimer) clearTimeout(currentAutoRefreshTimer);
  currentAutoRefreshTimer = setTimeout(() => {
    loadWorkspace();
  }, delayMs);
}

async function openFile(path: string) {
  const res = await fetch(`/api/file/${encodeURIComponent(path)}`);
  const file = await res.json();
  selectedFile = path;
  currentFile.textContent = path;
  currentFileContent = file.content ?? '';
  editor.value = currentFileContent;
}

function updateTreeEmptyState() {
  const emptyState = document.querySelector('#treeEmptyState');
  if (emptyState) emptyState.remove();
}

/**
 * 显示模板选择对话框
 */
async function showTemplateSelectionDialog() {
  return new Promise<{ templateId: string; projectName: string } | null>(async (resolve) => {
    // 获取可用的模板列表
    const response = await fetch('/api/templates');
    const { templates } = await response.json() as { templates: Array<{ id: string; name: string; description: string; category: string }> };

    let dialog = document.querySelector<HTMLElement>('#templateSelectionDialog');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'templateSelectionDialog';
      dialog.className = 'tree-dialog-overlay';
      document.body.appendChild(dialog);
    }

    // 按类别分组模板
    const categories: Record<string, typeof templates> = {};
    for (const template of templates) {
      if (!categories[template.category]) {
        categories[template.category] = [];
      }
      categories[template.category].push(template);
    }

    const categoryNames: Record<string, string> = {
      frontend: '前端项目',
      backend: '后端项目',
      fullstack: '全栈项目',
      api: 'API 服务',
      cli: '命令行工具',
    };

    let templateHtml = '<div class="template-list">';
    for (const [category, categoryTemplates] of Object.entries(categories)) {
      templateHtml += `<div class="template-category">
        <h4>${categoryNames[category] || category}</h4>
        <div class="template-grid">`;
      for (const template of categoryTemplates) {
        templateHtml += `
          <button type="button" class="template-card" data-template-id="${template.id}">
            <span class="template-name">${template.name}</span>
            <span class="template-description">${template.description}</span>
          </button>`;
      }
      templateHtml += '</div></div>';
    }
    templateHtml += '</div>';

    dialog.innerHTML = `
      <div class="tree-dialog" style="max-width: 600px; max-height: 70vh; overflow-y: auto;">
        <h3>选择项目模板</h3>
        <p>选择一个模板快速开始新项目</p>
        ${templateHtml}
        <div class="tree-dialog-actions">
          <button type="button" data-role="cancel">取消</button>
        </div>
      </div>
    `;
    dialog.classList.add('visible');

    let selectedTemplate: string | null = null;

    // 处理模板选择
    dialog.querySelectorAll<HTMLButtonElement>('.template-card').forEach((button) => {
      button.addEventListener('click', () => {
        selectedTemplate = button.dataset.templateId || null;
        if (selectedTemplate) {
          // 进入项目名称输入
          showProjectNameInputDialog(selectedTemplate).then((projectName) => {
            dialog!.classList.remove('visible');
            resolve(projectName ? { templateId: selectedTemplate!, projectName } : null);
          });
        }
      });
    });

    // 处理取消
    dialog.querySelector<HTMLButtonElement>('[data-role="cancel"]')!.addEventListener('click', () => {
      dialog!.classList.remove('visible');
      resolve(null);
    });
  });
}

/**
 * 显示项目名称输入对话框
 */
function showProjectNameInputDialog(templateId: string): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    let dialog = document.querySelector<HTMLElement>('#projectNameInputDialog');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'projectNameInputDialog';
      dialog.className = 'tree-dialog-overlay';
      dialog.innerHTML = `
        <div class="tree-dialog">
          <h3>创建项目</h3>
          <p>请输入项目名称</p>
          <input data-role="input" type="text" placeholder="例如: my-app, my-project" />
          <div class="tree-dialog-actions">
            <button type="button" data-role="cancel">取消</button>
            <button type="button" data-role="confirm">创建</button>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);
    }

    const input = dialog.querySelector<HTMLInputElement>('[data-role="input"]')!;
    input.value = 'my-project';
    dialog.classList.add('visible');
    input.focus();
    input.select();

    const cleanup = () => {
      dialog!.classList.remove('visible');
    };

    const handleConfirm = () => {
      const value = input.value.trim();
      cleanup();
      resolve(value || null);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    dialog.querySelector<HTMLButtonElement>('[data-role="confirm"]')!.onclick = handleConfirm;
    dialog.querySelector<HTMLButtonElement>('[data-role="cancel"]')!.onclick = handleCancel;

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleConfirm();
      if (e.key === 'Escape') handleCancel();
    });
  });
}

/**
 * 流式生成项目骨架
 */
async function streamGenerateScaffold(projectName: string, templateId: string) {
  const response = await fetch('/api/scaffold/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectName, templateId }),
  });

  if (!response.ok || !response.body) {
    throw new Error('项目生成请求失败');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const assistantMessage = appendMessage('agent', '');
  let finalResult: PreviewResult | null = null;
  let generatedFileCount = 0;

  const updateAssistant = (text: string) => {
    assistantMessage.textContent = text;
    chatLog.scrollTop = chatLog.scrollHeight;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const line = part.split('\n').find((item) => item.startsWith('data: '));
      if (!line) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') continue;

      try {
        const event = JSON.parse(payload) as
          | ToolEvent
          | { type: 'chunk'; chunk: string }
          | { type: 'result'; result: PreviewResult }
          | { type: 'error'; message: string };

        if (event.type === 'chunk') {
          updateAssistant((assistantMessage.textContent || '') + event.chunk);
        } else if (event.type === 'tool') {
          generatedFileCount++;
          updateAssistant(`✓ 已生成 ${generatedFileCount} 个文件...\n\n${event.summary || '正在生成项目'}`);
        } else if (event.type === 'result') {
          finalResult = event.result;
          updateAssistant(`✅ 项目骨架生成完成！\n\n${projectName} 项目已生成 ${generatedFileCount} 个文件。\n\n现在你可以开始编辑文件或继续输入需求来修改项目。`);
          scheduleWorkspaceRefresh(200);
        } else if (event.type === 'error') {
          updateAssistant(`❌ 出错了：${event.message}`);
        }
      } catch (e) {
        console.error('解析事件失败:', e);
        continue;
      }
    }
  }

  return finalResult;
}
  const response = await fetch('/api/agent/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, selectedFile }),
  });

  if (!response.ok || !response.body) {
    throw new Error('流式请求失败');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const assistantMessage = appendMessage('agent', '');
  let finalResult: PreviewResult | null = null;
  let sawWriteFileSuccess = false;
  let currentMessageElement: HTMLElement = assistantMessage;
  let toolCallElement: HTMLElement | null = null;
  let pendingToolDetails = '';

  const ensureToolNode = () => {
    if (toolCallElement) return toolCallElement;
    toolCallElement = document.createElement('div');
    toolCallElement.className = 'tool-call';
    toolCallElement.dataset.kind = 'tool';
    toolCallElement.dataset.expanded = 'false';
    toolCallElement.innerHTML = `
      <button type="button" class="tool-call-header">
        <span class="tool-call-arrow">▸</span>
        <span class="tool-call-title">工具调用结果</span>
      </button>
      <pre class="tool-call-body"></pre>
    `;
    chatLog.replaceChild(toolCallElement, assistantMessage);
    currentMessageElement = toolCallElement;

    const header = toolCallElement.querySelector<HTMLButtonElement>('.tool-call-header')!;
    const arrow = toolCallElement.querySelector<HTMLElement>('.tool-call-arrow')!;
    const body = toolCallElement.querySelector<HTMLElement>('.tool-call-body')!;
    header.addEventListener('click', () => {
      const expanded = toolCallElement!.dataset.expanded === 'true';
      toolCallElement!.dataset.expanded = expanded ? 'false' : 'true';
      arrow.textContent = expanded ? '▸' : '▾';
      body.style.display = expanded ? 'none' : 'block';
    });
    body.style.display = 'none';
    return toolCallElement;
  };

  const updateAssistant = (text: string) => {
    currentMessageElement.textContent = text;
    chatLog.scrollTop = chatLog.scrollHeight;
  };

  const appendToolDetail = (text: string) => {
    const node = ensureToolNode();
    const body = node.querySelector<HTMLElement>('.tool-call-body')!;
    pendingToolDetails = pendingToolDetails ? `${pendingToolDetails}\n${text}` : text;
    body.textContent = pendingToolDetails;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const line = part.split('\n').find((item) => item.startsWith('data: '));
      if (!line) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') continue;

      try {
        const event = JSON.parse(payload) as ToolEvent | { type: 'chunk'; chunk: string } | { type: 'result'; result: PreviewResult } | { type: 'error'; message: string };
        if (event.type === 'chunk') {
          updateAssistant((assistantMessage.textContent || '') + event.chunk);
        } else if (event.type === 'tool') {
          appendToolDetail(`${event.summary || '工具调用结果'}\n\n${event.detail || ''}`);
        } else if (event.type === 'result') {
          finalResult = event.result;
          const toolResults = finalResult?.toolResults ?? finalResult?.data?.toolResults ?? [];
          sawWriteFileSuccess = toolResults.some((item) => item?.name === 'write_file' && item?.result?.ok);
          if (sawWriteFileSuccess) {
            scheduleWorkspaceRefresh(100);
          }
        } else if (event.type === 'error') {
          updateAssistant(`出错了：${event.message}`);
        }
      } catch {
        continue;
      }
    }
  }

  if (sawWriteFileSuccess) {
    scheduleWorkspaceRefresh(0);
  }

  return finalResult;
}

editor.addEventListener('input', saveCurrentFile);
editor.addEventListener('blur', saveCurrentFile);

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  appendMessage('user', prompt);
  promptInput.value = '';
  appendMessage('agent', '正在分析需求并生成执行计划…');

  try {
    const result = await streamPreview(prompt);
    summary.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    appendMessage('agent', `请求失败：${(error as Error).message}`);
  }
});

refreshBtn.addEventListener('click', loadWorkspace);
newItemBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleNewItemMenu();
});
newItemMenu?.querySelectorAll<HTMLButtonElement>('button[data-kind]').forEach((button) => {
  button.addEventListener('click', async () => {
    hideNewItemMenu();
    const createKind = button.dataset.kind as 'file' | 'folder';
    await createWorkspaceItem(createKind, '');
  });
});
document.addEventListener('click', () => {
  hideContextMenu();
  hideNewItemMenu();
});
loadLayoutState();
applyLayoutWidths();
initResizers();
loadExpandedFolders();
loadWorkspace();

// 添加模板生成按钮到新建菜单
const newItemMenuElement = newItemMenu;
if (newItemMenuElement) {
  const scaffoldButton = document.createElement('button');
  scaffoldButton.type = 'button';
  scaffoldButton.textContent = '📦 生成项目模板';
  scaffoldButton.style.borderTop = '1px solid #ccc';
  scaffoldButton.style.marginTop = '8px';
  scaffoldButton.style.paddingTop = '8px';
  scaffoldButton.addEventListener('click', async () => {
    hideNewItemMenu();
    const result = await showTemplateSelectionDialog();
    if (result) {
      appendMessage('user', `生成 ${result.projectName} 项目（${result.templateId}）`);
      appendMessage('agent', `正在生成 ${result.projectName} 项目骨架…`);
      try {
        await streamGenerateScaffold(result.projectName, result.templateId);
      } catch (error) {
        appendMessage('agent', `项目生成失败：${(error as Error).message}`);
      }
    }
  });
  newItemMenuElement.appendChild(scaffoldButton);
}

appendMessage('agent', 'MVP 已启动：选择"新建 > 📦 生成项目模板"来快速启动项目，或浏览文件树后输入需求开始。');
