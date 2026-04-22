const chatLog = document.querySelector('#chatLog');
const chatForm = document.querySelector('#chatForm');
const promptInput = document.querySelector('#promptInput');
const fileTree = document.querySelector('#fileTree');
const editor = document.querySelector('#editor');
const currentFile = document.querySelector('#currentFile');
const summary = document.querySelector('#summary');
const refreshBtn = document.querySelector('#refreshBtn');

let selectedFile = null;
let workspaceCache = [];

function appendMessage(role, text) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderTree(nodes, prefix = '') {
  fileTree.innerHTML = '';

  const renderNode = (node, parentPath = '') => {
    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    if (node.type === 'folder') {
      const folder = document.createElement('div');
      folder.className = 'file-item';
      folder.textContent = `📁 ${fullPath}`;
      fileTree.appendChild(folder);
      (node.children || []).forEach((child) => renderNode(child, fullPath));
      return;
    }

    const item = document.createElement('div');
    item.className = 'file-item';
    item.textContent = `📄 ${fullPath}`;
    item.addEventListener('click', () => openFile(fullPath));
    fileTree.appendChild(item);
  };

  nodes.forEach((node) => renderNode(node, prefix));
}

async function loadWorkspace() {
  const res = await fetch('/api/workspace');
  const data = await res.json();
  workspaceCache = data.tree;
  renderTree(workspaceCache);
}

async function openFile(path) {
  const res = await fetch(`/api/file/${encodeURIComponent(path)}`);
  const file = await res.json();
  selectedFile = path;
  currentFile.textContent = path;
  editor.value = file.content ?? '';
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  appendMessage('user', prompt);
  promptInput.value = '';
  appendMessage('agent', '正在分析需求并生成执行计划…');

  const res = await fetch('/api/agent/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, selectedFile }),
  });
  const data = await res.json();

  summary.textContent = JSON.stringify(data, null, 2);
  appendMessage('agent', '已完成最小流程：理解需求、生成计划、准备修改与验证。');
});

refreshBtn.addEventListener('click', loadWorkspace);

loadWorkspace();
appendMessage('agent', 'MVP 已启动：你可以先浏览文件树，再输入一个需求开始。');
