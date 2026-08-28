/** 生成唯一 ID（时间戳 + 随机串） */
export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
