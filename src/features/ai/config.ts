/**
 * 本地 Ollama 连接与模型配置。
 *
 * 设计要点：
 * - 地址固定用 127.0.0.1（macOS 上 localhost 可能解析到 ::1，导致连不上只监听 IPv4 的 ollama）
 * - 模型名不写死在组件里：优先用用户上次选择的模型，其次按偏好前缀在 /api/tags 里自动挑
 * - 若本机换了模型（例如 ollama pull 了新版本），无需改代码，打开助手即可自动识别
 */

/** 允许用 VITE_OLLAMA_HOST 覆盖地址（默认本机 11434） */
const ENV_HOST = (import.meta.env.VITE_OLLAMA_HOST as string | undefined)?.trim();

export const OLLAMA_BASE = (ENV_HOST || 'http://127.0.0.1:11434').replace(/\/+$/, '');
export const TAGS_URL = `${OLLAMA_BASE}/api/tags`;
export const CHAT_URL = `${OLLAMA_BASE}/api/chat`;

/** 本机 ollama list 中已拉取的默认模型 */
export const DEFAULT_MODEL = 'kaelri/qwen3.5-mt:2b';

/**
 * 自动挑选模型时的偏好顺序（按前缀匹配）。
 * qwen3.5-mt 排在最前，其次同代通用模型，再退到常见可用模型。
 */
const MODEL_PREFERENCE = [
  'kaelri/qwen3.5-mt',
  'qwen3.5-mt',
  'qwen3.5',
  'qwen3',
  'qwen2.5',
  'gemma3',
  'llama3.1',
  'llama3',
];

/** 上次手动选择的模型（仅前端偏好，不入账本文件） */
const MODEL_STORAGE_KEY = 'ai_preferred_model';

export interface OllamaModel {
  /** 完整模型名（含 namespace:tag） */
  name: string;
  /** 体积（字节），用于展示 */
  size?: number;
  /** 参数量描述，如 2.3B */
  params?: string;
}

/** 对话请求参数：为 2B 小模型定的稳健组合（低温度、足够上下文、限制长度） */
export const CHAT_OPTIONS = {
  temperature: 0.3,
  top_p: 0.7,
  repeat_penalty: 1.05,
  num_ctx: 8192,
  num_predict: 1200,
} as const;

/** 模型在显存/内存中保活时长 */
export const KEEP_ALIVE = '10m';

export function getSavedModel(): string | null {
  try {
    return localStorage.getItem(MODEL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveModel(name: string): void {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, name);
  } catch {
    /* 隐私模式下忽略 */
  }
}

/** 拉取本机已安装模型列表；失败（ollama 未启动）返回空数组 */
export async function fetchModels(): Promise<OllamaModel[]> {
  try {
    const res = await fetch(TAGS_URL, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      models?: Array<{ name?: string; model?: string; size?: number; details?: { parameter_size?: string } }>;
    };
    return (data.models ?? [])
      .map((m) => ({
        name: m.name || m.model || '',
        size: m.size,
        params: m.details?.parameter_size,
      }))
      .filter((m) => m.name);
  } catch {
    return [];
  }
}

/** 从可用模型里挑一个：用户上次选的 > 偏好顺序 > 第一个 */
export function pickModel(models: OllamaModel[]): string {
  if (models.length === 0) return getSavedModel() || DEFAULT_MODEL;

  const saved = getSavedModel();
  if (saved && models.some((m) => m.name === saved)) return saved;

  for (const pref of MODEL_PREFERENCE) {
    const hit = models.find((m) => m.name.toLowerCase().includes(pref));
    if (hit) return hit.name;
  }
  return models[0].name;
}

/** 模型体积友好展示 */
export function formatModelSize(size?: number): string {
  if (!size) return '';
  const gb = size / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)}GB` : `${Math.round(size / 1024 ** 2)}MB`;
}
