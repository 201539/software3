export const templates = {
  "vite-react-ts": {
    id: "vite-react-ts",
    name: "Vite + React + TypeScript",
    description: "使用 Vite 构建的现代化 React 项目模板",
    category: "frontend",
    language: "typescript",
    framework: "React",
    version: "18.0",
    files: [
      {
        path: "package.json",
        content: `{
  "name": "{{projectName}}",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}`,
      },
      {
        path: "index.html",
        content: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{projectName}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
      },
      {
        path: "src/main.tsx",
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)
  return (
    <main style={{ padding: 24 }}>
      <h1>{{projectName}}</h1>
      <button onClick={() => setCount((c) => c + 1)}>点击数: {count}</button>
    </main>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
`,
      },
    ],
  },
  "express-api": {
    id: "express-api",
    name: "Express API 服务",
    description: "快速创建 Node.js Express REST API 服务",
    category: "backend",
    language: "typescript",
    framework: "Express",
    version: "4.18",
    files: [
      {
        path: "package.json",
        content: `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}`,
      },
      {
        path: "src/index.ts",
        content: `import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', project: '{{projectName}}' });
});

app.listen(port, () => {
  console.log(\`Server running on http://localhost:\${port}\`);
});`,
      },
    ],
  },
  "next-app": {
    id: "next-app",
    name: "Next.js 应用",
    description: "基于 Next.js 的现代化全栈应用模板",
    category: "fullstack",
    language: "typescript",
    framework: "Next.js",
    version: "14.0",
    files: [
      {
        path: "package.json",
        content: `{
  "name": "{{projectName}}",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}`,
      },
      {
        path: "app/page.tsx",
        content: `export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>{{projectName}}</h1>
      <p>Next.js 模板已生成。</p>
    </main>
  );
}`,
      },
    ],
  },
  "react-app": {
    id: "react-app",
    name: "Create React App",
    description: "使用 Create React App 快速创建 React 项目",
    category: "frontend",
    language: "javascript",
    framework: "React",
    version: "18.0",
    files: [
      {
        path: "package.json",
        content: `{
  "name": "{{projectName}}",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  }
}`,
      },
      {
        path: "src/App.js",
        content: `export default function App() {
  return <h1>{{projectName}}</h1>;
}`,
      },
    ],
  },
};

export function getTemplate(templateId) {
  return templates[templateId];
}

export function listTemplates() {
  return Object.values(templates);
}

export function listTemplatesByCategory(category) {
  return Object.values(templates).filter((item) => item.category === category);
}
