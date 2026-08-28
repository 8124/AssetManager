/**
 * 资产领域模型：纯类型与纯函数。
 *
 * 本模块不依赖 React、不依赖存储层，只包含：
 * - 资产记录 / 汇率 / 时间序列快照的类型定义
 * - 纯计算函数（币种折算、金额表达式解析、类别派生、年度均值等）
 */

export interface IAssetRecord {
  id: string;
  /** 资产名称（必填） */
  name: string;
  /** 资产类别 */
  category: string;
  /** 原始金额 */
  amount: number;
  /** 币种 */
  currency: 'CNY' | 'USD';
  /** 折算人民币金额 */
  amountCNY: number;
  /** 日期，格式 YYYY-MM-DD */
  date: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 数据来源（mock 或 user） */
  source?: 'mock' | 'user';
}

export interface IExchangeRate {
  /** USD -> CNY 汇率 */
  rate: number;
  /** 更新时间戳 */
  updatedAt: number;
  /** 来源：auto=API自动获取 / manual=手动设置 */
  source: 'auto' | 'manual';
}

/**
 * 按日期聚合的资产快照：
 * - categories：该日期下各资产类别的人民币金额汇总
 * - tolamount：该日期总资产金额（人民币）
 */
export interface IRecordLineEntry {
  date: string;
  categories: Record<string, number>;
  tolamount: number;
}

export const STORAGE_KEYS = {
  RECORDS: 'asset_records',
  RATE: 'asset_exchange_rate',
  RECORD_LINE: 'recordline',
} as const;

export const DEFAULT_RATE: IExchangeRate = {
  rate: 7.2,
  updatedAt: Date.now(),
  source: 'manual',
};

/** 将原始金额按币种折算为人民币金额 */
export function computeAmountCNY(
  amount: number,
  currency: 'CNY' | 'USD',
  rate: number,
): number {
  return currency === 'USD' ? +(amount * rate).toFixed(2) : amount;
}

/** 人民币金额格式化：¥ 1,234.56 */
export function formatCurrencyCNY(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value);
}

/** 资产显示标签：优先「类别·名称」，缺省时回退到非空字段 */
export function formatAssetLabel(record: { name: string; category: string }): string {
  if (!record.name) return record.category;
  if (!record.category) return record.name;
  return `${record.category}·${record.name}`;
}

/**
 * 仅支持 + - 的简单运算表达式，例如 "1+1" / "100-30" / "1000+500-200"。
 * 非法表达式返回 NaN。绝不使用 eval()，采用白名单字符校验 + 正则分词解析。
 */
export function evalSimpleExpression(input: string): number {
  const trimmed = input.trim().replace(/,/g, '');
  if (!trimmed) return NaN;

  // 纯数字（含小数）
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // 仅含数字、.、+、- 的表达式
  if (!/^[\d+\-.]+$/.test(trimmed) || /[+\-.]{2,}/.test(trimmed)) {
    return NaN;
  }

  // 统一添加首 + 号便于 split
  const normalized =
    trimmed.startsWith('-') || trimmed.startsWith('+')
      ? trimmed
      : `+${trimmed}`;
  const tokens = normalized.match(/[+-]\d+(\.\d+)?/g);
  if (!tokens || tokens.length === 0) return NaN;

  const result = tokens.reduce((sum, t) => sum + parseFloat(t), 0);
  return +result.toFixed(2);
}

/**
 * 从资产记录中自动派生类别列表（去重，按首次出现顺序）。
 * 无需单独存储类别，添加记录时用了新类别会自动出现。
 */
export function deriveCategories(records: Array<{ category: string }>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const r of records) {
    if (r.category && !seen.has(r.category)) {
      seen.add(r.category);
      result.push(r.category);
    }
  }
  return result;
}

/**
 * 计算"今年平均资产"：
 * 取当前年份每个月 recordline 中最后一条（月末快照）的资产总额，求和后
 * 除以有数据的月份数（不足 12 个月则按实际月数除）；无本年度数据返回 null。
 */
export function computeYearAvgFromRecordLine(
  recordLine: IRecordLineEntry[],
  year = new Date().getFullYear(),
): number | null {
  const prefix = String(year);
  const monthMap = new Map<string, IRecordLineEntry>();
  for (const entry of recordLine) {
    if (!entry.date.startsWith(prefix)) continue;
    const month = entry.date.slice(0, 7);
    const existing = monthMap.get(month);
    if (!existing || entry.date > existing.date) {
      monthMap.set(month, entry);
    }
  }
  const totals = Array.from(monthMap.values()).map((e) => e.tolamount);
  if (totals.length === 0) return null;
  const sum = totals.reduce((s, v) => s + v, 0);
  return +(sum / totals.length).toFixed(2);
}
