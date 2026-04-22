function normalizeText(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/gu)
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function scoreFile(filePath, promptTokens, selectedFileTokens) {
  const pathTokens = tokenize(filePath);
  const combined = new Set([...promptTokens, ...selectedFileTokens]);
  let score = 0;

  for (const token of pathTokens) {
    if (combined.has(token)) score += 6;
    if (promptTokens.includes(token)) score += 4;
    if (selectedFileTokens.includes(token)) score += 2;
  }

  if (filePath === 'package.json') score += 3;
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) score += 2;
  return score;
}

function compressFileContent(content, maxLines = 24) {
  const lines = String(content ?? '').split('\n');
  if (lines.length <= maxLines) return lines.join('\n');

  const head = lines.slice(0, Math.ceil(maxLines / 2));
  const tail = lines.slice(-Math.floor(maxLines / 2));
  return [...head, '... (content truncated) ...', ...tail].join('\n');
}

function buildWorkspaceSummary(files, options) {
  const { maxFiles, maxChars, selectedFile } = options;
  const summary = [];
  let charCount = 0;

  for (const file of files.slice(0, maxFiles)) {
    const content = file.path === selectedFile ? compressFileContent(file.content, 32) : compressFileContent(file.content, 16);
    const block = [`FILE: ${file.path}`, content ? content : '(empty)', ''].join('\n');
    if (charCount + block.length > maxChars) break;
    summary.push(block);
    charCount += block.length;
  }

  return summary.join('\n');
}

export function createContextBuilder(toolGateway, options = {}) {
  const maxFiles = options.maxFiles ?? 8;
  const maxChars = options.maxChars ?? 12000;

  return {
    buildForPrompt(prompt, selectedFile = null) {
      const files = toolGateway.listWorkspace();
      const selectedFileContent = selectedFile ? toolGateway.readFile(selectedFile) : null;

      const promptTokens = tokenize(prompt);
      const selectedFileTokens = tokenize(selectedFile ?? '');

      const rankedFiles = unique([
        ...files
          .map((file) => ({
            ...file,
            score: scoreFile(file.path, promptTokens, selectedFileTokens),
          }))
          .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)),
        ...files.map((file) => ({ ...file, score: 0 })),
      ]).slice(0, maxFiles);

      const workspaceSummary = buildWorkspaceSummary(rankedFiles, {
        maxFiles,
        maxChars,
        selectedFile,
      });

      return {
        prompt,
        selectedFile,
        selectedFileContent,
        workspaceSummary,
        contextBudget: {
          maxFiles,
          maxChars,
          includedFiles: rankedFiles.map((file) => file.path),
        },
      };
    },
  };
}
