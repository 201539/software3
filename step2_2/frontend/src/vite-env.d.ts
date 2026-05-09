/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  /** 可选：后端若启用 Bearer 认证，在 .env.local 中配置，勿提交仓库 */
  readonly VITE_API_BEARER_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
