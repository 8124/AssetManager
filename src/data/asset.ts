

import { useState, useEffect, useCallback, useRef } from 'react';
import { localFileStore } from './localFileStore';

export interface IAssetRecord {
  id: string;
  /** 资产名称（必填） */
  name: string;
  /** 资产类别 */
  category: string;
  amount: number;
  currency: 'CNY' | 'USD';
  amountCNY: number;
  date: string;
  createdAt: number;
  source?: 'mock' | 'user';
}

export function formatAssetLabel(record: { name: string; category: string }): string {
  if (!record.name) return record.category;
  if (!record.category) return record.name;
  return `${record.category}·${record.name}`;
}

export interface IExchangeRate {
  rate: number;
  updatedAt: number;
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

const genId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function loadJSON<T>(key: string, fallback: T): T {
  // FileStoreGate 已确保文件就绪，此处同步读取内存中的数据
  const value = localFileStore.get(key as any);
  return (value ?? fallback) as T;
}

function saveJSON(key: string, value: unknown) {
  // 写入内存并自动防抖写盘，无需 await
  localFileStore.set(key as any, value);
}

function computeAmountCNY(amount: number, currency: 'CNY' | 'USD', rate: number) {
  return currency === 'USD' ? +(amount * rate).toFixed(2) : amount;
}

export function formatCurrencyCNY(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * 仅支持 + - 的简单运算表达式，例如 "1+1" / "100-30" / "1000+500-200"
 * 非法表达式返回 NaN
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
  const normalized = trimmed.startsWith('-') || trimmed.startsWith('+')
    ? trimmed
    : `+${trimmed}`;
  const tokens = normalized.match(/[+-]\d+(\.\d+)?/g);
  if (!tokens || tokens.length === 0) return NaN;

  const result = tokens.reduce((sum, t) => sum + parseFloat(t), 0);
  return +result.toFixed(2);
}

export function useAssetRecords(rate: number) {
  const [records, setRecords] = useState<IAssetRecord[]>(() =>
    loadJSON<IAssetRecord[]>(STORAGE_KEYS.RECORDS, []),
  );
  // 记录最后一次增删改操作对应的日期，用于只更新该日期的 recordline
  const lastActionDateRef = useRef<string | null>(null);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.RECORDS, records);

    // 只更新最后操作日期的 recordline 条目，其他日期保持不变
    const date = lastActionDateRef.current;
    if (date) {
      const categoryTotals: Record<string, number> = {};
      for (const r of records) {
        categoryTotals[r.category] = +(
          (categoryTotals[r.category] || 0) + r.amountCNY
        ).toFixed(2);
      }
      const total = +Object.values(categoryTotals).reduce((s, v) => s + v, 0).toFixed(2);

      const currentLine = loadJSON<IRecordLineEntry[]>(STORAGE_KEYS.RECORD_LINE, []);
      const entry: IRecordLineEntry = { date, categories: categoryTotals, tolamount: total };
      const idx = currentLine.findIndex((e) => e.date === date);
      // 必须创建新数组，否则 localFileStore 中引用不变，useRecordLine 不会触发刷新
      const nextLine: IRecordLineEntry[] =
        idx >= 0
          ? currentLine.map((e, i) => (i === idx ? entry : e))
          : [...currentLine, entry].sort((a, b) => a.date.localeCompare(b.date));
      saveJSON(STORAGE_KEYS.RECORD_LINE, nextLine);
      lastActionDateRef.current = null;
    }
  }, [records]);

  // 订阅外部数据变更（导入 JSON、切换账本等），同步刷新 React 状态
  useEffect(() => {
    return localFileStore.subscribe(() => {
      const latest = loadJSON<IAssetRecord[]>(STORAGE_KEYS.RECORDS, []);
  
      setRecords((prev) => (prev === latest ? prev : latest));
    });
  }, []);

  // 汇率变动时重新折算所有 USD 记录的 amountCNY
  useEffect(() => {
    setRecords((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (r.currency !== 'USD') return r;
        const newCNY = computeAmountCNY(r.amount, 'USD', rate);
        if (Math.abs(newCNY - r.amountCNY) < 0.01) return r;
        changed = true;
        return { ...r, amountCNY: newCNY };
      });
      return changed ? next : prev;
    });
  }, [rate]);

  const addRecord = useCallback(
    (data: { name: string; category: string; amount: number; currency: 'CNY' | 'USD'; date: string }) => {
      const record: IAssetRecord = {
        id: genId(),
        name: data.name,
        category: data.category,
        amount: data.amount,
        currency: data.currency,
        amountCNY: computeAmountCNY(data.amount, data.currency, rate),
        date: data.date,
        createdAt: Date.now(),
        source: 'user',
      };
      lastActionDateRef.current = data.date;
      setRecords((prev) => [...prev, record]);
      return record;
    },
    [rate],
  );

  const updateRecord = useCallback(
    (id: string, data: Partial<Pick<IAssetRecord, 'name' | 'category' | 'amount' | 'currency' | 'date'>>) => {
      lastActionDateRef.current = data.date ?? null;
      setRecords((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, ...data };
          const amount = data.amount ?? r.amount;
          const currency = data.currency ?? r.currency;
          next.amountCNY = computeAmountCNY(amount, currency, rate);
          return next;
        }),
      );
    },
    [rate],
  );

  const deleteRecord = useCallback((id: string) => {
    setRecords((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) lastActionDateRef.current = target.date;
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  return { records, addRecord, updateRecord, deleteRecord, setRecords };
}

/**
 * 读取 recordline（按日期聚合的资产快照），订阅 localFileStore 变更自动刷新
 */
export function useRecordLine() {
  const [recordLine, setRecordLine] = useState<IRecordLineEntry[]>(() =>
    loadJSON<IRecordLineEntry[]>(STORAGE_KEYS.RECORD_LINE, []),
  );

  useEffect(() => {
    return localFileStore.subscribe(() => {
      const latest = loadJSON<IRecordLineEntry[]>(STORAGE_KEYS.RECORD_LINE, []);
      setRecordLine((prev) => (prev === latest ? prev : latest));
    });
  }, []);

  return recordLine;
}

export function useExchangeRate() {
  const [rateInfo, setRateInfo] = useState<IExchangeRate>(() =>
    loadJSON<IExchangeRate>(STORAGE_KEYS.RATE, DEFAULT_RATE),
  );

  useEffect(() => {
    saveJSON(STORAGE_KEYS.RATE, rateInfo);
  }, [rateInfo]);

  // 订阅外部数据变更（导入 JSON、切换账本等），同步刷新 React 状态
  useEffect(() => {
    return localFileStore.subscribe(() => {
      const latest = loadJSON<IExchangeRate>(STORAGE_KEYS.RATE, DEFAULT_RATE);
      setRateInfo((prev) => (prev === latest ? prev : latest));
    });
  }, []);

  const setManualRate = useCallback((rate: number) => {
    setRateInfo({ rate, updatedAt: Date.now(), source: 'manual' });
  }, []);

  const fetchRate = useCallback(async () => {
    // 公开免费汇率 API（无需 key）
    const res = await fetch(
      'https://api.exchangerate-api.com/v4/latest/USD',
    );
    if (!res.ok) throw new Error('Network error');
    const data = (await res.json()) as { rates: { CNY: number } };
    const cnyRate = data?.rates?.CNY;
    if (typeof cnyRate !== 'number' || cnyRate <= 0) throw new Error('Invalid rate');
    setRateInfo({ rate: +cnyRate.toFixed(4), updatedAt: Date.now(), source: 'auto' });
    return cnyRate;
  }, []);

  return { rateInfo, setManualRate, fetchRate };
}

/**
 * 从资产记录中自动派生类别列表（去重，按首次出现顺序）
 * 不再需要单独存储 categories，添加记录时用了新类别会自动出现
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
 * 根据资产记录全量计算按日期聚合的 recordline：
 * - 每个日期一条记录，categories 包含所有大类别，金额直接取各类别当前全量汇总值
 * - tolamount 为全部类别金额之和
 * 全量重算天然满足"无此 date 则新增、有则覆盖"的语义。
 */
export function computeRecordLine(records: IAssetRecord[]): IRecordLineEntry[] {
  // 1. 收集全量类别（按首次出现顺序）和所有日期
  const allCategories: string[] = [];
  const seen = new Set<string>();
  const dates = new Set<string>();
  for (const r of records) {
    dates.add(r.date);
    if (r.category && !seen.has(r.category)) {
      seen.add(r.category);
      allCategories.push(r.category);
    }
  }

  // 2. 计算各类别当前总金额（全量汇总，不区分日期）
  const categoryTotals: Record<string, number> = {};
  for (const c of allCategories) categoryTotals[c] = 0;
  for (const r of records) {
    categoryTotals[r.category] = +(categoryTotals[r.category] + r.amountCNY).toFixed(2);
  }
  const totalAmount = +allCategories.reduce((sum, c) => sum + categoryTotals[c], 0).toFixed(2);

  // 3. 每个日期都使用当前全量类别金额
  return Array.from(dates)
    .sort()
    .map((date) => ({
      date,
      categories: { ...categoryTotals },
      tolamount: totalAmount,
    }));
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
