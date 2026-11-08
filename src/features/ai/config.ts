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

/**
 * 对话参数。
 *
 * 关键约束（都是本机实测出来的，改之前先读）：
 * - 始终关闭模型思考（请求体顶层 `think: false`）。实测思考 token 与正文共享 num_predict，
 *   且思考长度完全不受控：同一提示词只改预算，一次 118s 正常收尾（思考 6391 字），
 *   另一次 199s 空转（思考 13546 字、正文 0 字，done_reason=length）。
 *   关掉之后同一个问题 11~26 秒出 290~860 字答案，稳定得多。
 * - 生成速度：qwen3.5:4b 约 15~20 tok/s，9b 约 10~19 tok/s。
 *   num_predict 给 1700：实测正文一般 300~900 token，留足余量又不至于长时间空转。
 * - 上下文按 4096 设计（ollama 默认值，本机 MLX runner 会忽略请求里的 num_ctx），
 *   所以「提示词约 1200 + 历史 4 条 + 生成 1700」必须压在这个范围内。
 */
export const CHAT_OPTIONS = {
  temperature: 0.3,
  top_p: 0.7,
  repeat_penalty: 1.05,
  num_ctx: 4096,
  num_predict: 1700,
} as const;

/** 是否开启模型思考：固定关闭，界面上不提供开关 */
export const THINK = false;

/** 历史消息最多带几条（上下文只有 4096，带太多会挤掉账本数据） */
export const MAX_HISTORY_MESSAGES = 4;

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
