/**
 * 统一格式化工具：数字 / 金额 / 日期展示。
 *
 * 所有涉及金额展示的组件统一从这里取格式化函数，
 * 避免各组件各自写一套 toLocaleString 配置。
 */

/** 千分位数字格式化；默认保留 2 位小数（可传 max 覆盖上限） */
export function formatNumber(value: number, min = 2, max?: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: min,
    ...(max !== undefined ? { maximumFractionDigits: max } : {}),
  });
}

/** 将 "YYYY-MM-DD" 格式化为 "M月D日" */
export function formatMonthDay(dateStr: string): string {
  const m = parseInt(dateStr.slice(5, 7), 10);
  const day = parseInt(dateStr.slice(8, 10), 10);
  return `${m}月${day}日`;
}
