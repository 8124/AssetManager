/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 可选：覆盖本地 Ollama 地址，例如 http://192.168.1.10:11434 */
  readonly VITE_OLLAMA_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
