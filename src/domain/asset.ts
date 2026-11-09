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
 * 按日期聚合的资产快照（柱状图 / 折线图 / 历史数据的唯一数据源）
 * - categories：该日期下各资产类别的人民币金额汇总
 * - tolamount：该日期总资产金额（人民币）
 *
 * 约定：每个日期只有一条快照。今天的快照由「当前持仓记录」自动汇总生成，
 * 历史快照一经生成即冻结，只能在「记录条数」弹窗里手动修改。
 */
export interface IRecordLineEntry {
  date: string;
  categories: Record<string, number>;
  tolamount: number;
}

/** 今天（本地时区）的 YYYY-MM-DD */
export function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 汇总全部资产记录（记录代表「当前持仓清单」，不分录入日期），
 * 生成指定日期的快照。无记录时返回 null。
 *
 * 只用于生成「今天」的快照 —— 历史快照是独立存量的数据，
 * 绝不能再用当前记录去回算，否则历史数值会被今天的持仓覆盖。
 */
export function summarizeRecords(
  records: IAssetRecord[],
  date: string,
): IRecordLineEntry | null {
  if (records.length === 0) return null;
  const categories: Record<string, number> = {};
  for (const r of records) {
    if (!r.category) continue;
    categories[r.category] = +((categories[r.category] ?? 0) + r.amountCNY).toFixed(2);
  }
  if (Object.keys(categories).length === 0) return null;
  const tolamount = +Object.values(categories)
    .reduce((s, v) => s + v, 0)
    .toFixed(2);
  return { date, categories, tolamount };
}

/** 递增排序并去重（同日期保留后者），保证快照列表顺序稳定 */
export function sortRecordLine(line: IRecordLineEntry[]): IRecordLineEntry[] {
  const map = new Map<string, IRecordLineEntry>();
  for (const entry of line) map.set(entry.date, entry);
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export const STORAGE_KEYS = {
  RECORDS: 'asset_records',
  RATE: 'asset_exchange_rate',
  RECORD_LINE: 'recordline',
} as const;

export const DEFAULT_RATE: IExchangeRate = {
  rate: 7.2,
  updatedAt: Date.now(),
  source: 'auto',
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

/** 首次使用时的备选类别（仅用于表单下拉，不参与统计） */
export const DEFAULT_ASSET_CATEGORIES = ['现金', '股票', '基金', '房产'];

/** 表单可选项：已有类别在前，默认类别补齐在后 */
export function buildCategoryOptions(records: Array<{ category: string }>): string[] {
  const existing = deriveCategories(records);
  const extras = DEFAULT_ASSET_CATEGORIES.filter((c) => !existing.includes(c));
  return [...existing, ...extras];
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

/**
 * 计算"今年变化"：
 * 取本年度 recordline 中按日期排序后的最后一笔 tolamount 减去第一笔 tolamount。
 * 本年度少于 2 笔快照时返回 null（无法比较）。
 */
export function computeYearChangeFromRecordLine(
  recordLine: IRecordLineEntry[],
  year = new Date().getFullYear(),
): number | null {
  const prefix = String(year);
  const entries = recordLine
    .filter((e) => e.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length < 2) return null;
  const first = entries[0];
  const last = entries[entries.length - 1];
  return +(last.tolamount - first.tolamount).toFixed(2);
}
