/**
 * 资产数据 Hooks：桥接「本地存储」与「React 状态」。
 *
 * 统一封装两类数据源：
 * - useAssetRecords：资产记录（增删改 + 汇率折算 + 外部变更订阅）
 * - useRecordLine：按日期聚合的资产快照（趋势图数据源）
 *
 * 汇率（useExchangeRate）为页面共用的共享 Hook，见 @/hooks/useExchangeRate。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { genId } from '@/lib/id';
import { localFileStore } from '@/store/localFileStore';
import {
  computeAmountCNY,
  STORAGE_KEYS,
  type IAssetRecord,
  type IRecordLineEntry,
} from '@/domain/asset';

function loadJSON<T>(key: string, fallback: T): T {
  // FileStoreGate 已确保文件就绪，此处同步读取内存中的数据
  const value = localFileStore.get(key as never);
  return (value ?? fallback) as T;
}

function saveJSON(key: string, value: unknown) {
  // 写入内存并自动防抖写盘，无需 await
  localFileStore.set(key as never, value);
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
      const total = +Object.values(categoryTotals)
        .reduce((s, v) => s + v, 0)
        .toFixed(2);

      const currentLine = loadJSON<IRecordLineEntry[]>(STORAGE_KEYS.RECORD_LINE, []);
      const entry: IRecordLineEntry = {
        date,
        categories: categoryTotals,
        tolamount: total,
      };
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
    (data: {
      name: string;
      category: string;
      amount: number;
      currency: 'CNY' | 'USD';
      date: string;
    }) => {
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
    (
      id: string,
      data: Partial<Pick<IAssetRecord, 'name' | 'category' | 'amount' | 'currency' | 'date'>>,
    ) => {
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
