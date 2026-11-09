/**
 * 资产数据 Hooks：桥接「本地存储」与「React 状态」。
 *
 * 数据模型（重写后的记账模型）：
 * - asset_records：当前持仓清单。每条代表一项资产，金额/类别可随时编辑；
 *   记录上的 date 只是「录入日期」元信息，不参与任何按日期的计算。
 * - recordline：按日期聚合的资产快照，是柱状图 / 折线图 / 历史数据的唯一数据源。
 *
 * 写入规则（关键）：
 * 1. 新增 / 编辑 / 删除记录，以及汇率变化 → 只重写「今天」这一条快照；
 * 2. 历史日期的快照一经生成即冻结，绝不会被今天的持仓覆盖；
 * 3. 要修改历史某天的数据，只能走「记录条数」弹窗（手动编辑该日期快照）；
 * 4. 只浏览、切换账本、启动页面都不写入快照。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { genId } from '@/lib/id';
import { localFileStore } from '@/store/localFileStore';
import {
  computeAmountCNY,
  sortRecordLine,
  summarizeRecords,
  todayString,
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

/** 自动改写快照前保留一份原始数据，便于核对/回滚 */
const RECORD_LINE_BACKUP_KEY = '__app_recordline_backup';

function backupRecordLine(line: IRecordLineEntry[]) {
  if (line.length === 0) return;
  try {
    localStorage.setItem(
      RECORD_LINE_BACKUP_KEY,
      JSON.stringify({ savedAt: Date.now(), recordline: line }),
    );
  } catch {
    // localStorage 写入失败时忽略，不影响主流程
  }
}

/**
 * 把「今天」的快照同步为当前持仓汇总。
 * 只碰今天这一条，历史条目原样保留。
 */
function syncTodaySnapshot(records: IAssetRecord[]): void {
  const today = todayString();
  const line = loadJSON<IRecordLineEntry[]>(STORAGE_KEYS.RECORD_LINE, []);
  const entry = summarizeRecords(records, today);

  let next: IRecordLineEntry[];
  if (!entry) {
    // 记录清空：今天没有可展示的资产，移除今天的快照
    if (!line.some((e) => e.date === today)) return;
    next = line.filter((e) => e.date !== today);
  } else if (line.some((e) => e.date === today)) {
    next = sortRecordLine(line.map((e) => (e.date === today ? entry : e)));
  } else {
    next = sortRecordLine([...line, entry]);
  }

  if (JSON.stringify(next) === JSON.stringify(line)) return;
  saveJSON(STORAGE_KEYS.RECORD_LINE, next);
}

export function useAssetRecords(rate: number) {
  const [records, setRecords] = useState<IAssetRecord[]>(() =>
    loadJSON<IAssetRecord[]>(STORAGE_KEYS.RECORDS, []),
  );
  /** 是否有需要同步到「今天快照」的变更（只在用户操作后置位） */
  const todayDirtyRef = useRef(false);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.RECORDS, records);
    if (!todayDirtyRef.current) return;
    todayDirtyRef.current = false;
    syncTodaySnapshot(records);
  }, [records]);

  // 订阅外部数据变更（导入 JSON、切换账本等），同步刷新 React 状态
  useEffect(() => {
    return localFileStore.subscribe(() => {
      const latest = loadJSON<IAssetRecord[]>(STORAGE_KEYS.RECORDS, []);
      setRecords((prev) => (prev === latest ? prev : latest));
    });
  }, []);

  // 汇率变动时重新折算 USD 记录的 amountCNY，并刷新今天快照
  // （历史快照是冻结的记账结果，不因汇率变化而改写）
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
      if (changed) todayDirtyRef.current = true;
      return changed ? next : prev;
    });
  }, [rate]);

  const addRecord = useCallback(
    (data: {
      name: string;
      category: string;
      amount: number;
      currency: 'CNY' | 'USD';
    }) => {
      const record: IAssetRecord = {
        id: genId(),
        name: data.name,
        category: data.category,
        amount: data.amount,
        currency: data.currency,
        amountCNY: computeAmountCNY(data.amount, data.currency, rate),
        // 记录永远记在今天；历史数据只能通过快照编辑来修正
        date: todayString(),
        createdAt: Date.now(),
        source: 'user',
      };
      todayDirtyRef.current = true;
      setRecords((prev) => [...prev, record]);
      return record;
    },
    [rate],
  );

  const updateRecord = useCallback(
    (
      id: string,
      data: Partial<Pick<IAssetRecord, 'name' | 'category' | 'amount' | 'currency'>>,
    ) => {
      todayDirtyRef.current = true;
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
    todayDirtyRef.current = true;
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { records, addRecord, updateRecord, deleteRecord };
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

/**
 * 手动更新某一天的快照（「记录条数」弹窗专用，唯一能改历史数据的入口）。
 * - 日期未变：原位替换；
 * - 日期变更：删除旧条目、按新日期插入并排序；若新日期已存在快照则抛错。
 */
export function updateRecordLineEntry(
  prevDate: string,
  next: IRecordLineEntry,
): void {
  const line = loadJSON<IRecordLineEntry[]>(STORAGE_KEYS.RECORD_LINE, []);
  let nextLine: IRecordLineEntry[];
  if (next.date === prevDate) {
    nextLine = line.map((e) => (e.date === prevDate ? next : e));
  } else {
    if (line.some((e) => e.date === next.date)) {
      throw new Error('该日期已存在记录，请直接编辑那一天的记录');
    }
    nextLine = sortRecordLine(
      line.filter((e) => e.date !== prevDate).concat(next),
    );
  }
  backupRecordLine(line);
  saveJSON(STORAGE_KEYS.RECORD_LINE, nextLine);
}

/** 删除某一天的快照（该日期将从柱状图与占比图中移除） */
export function deleteRecordLineEntry(date: string): void {
  const line = loadJSON<IRecordLineEntry[]>(STORAGE_KEYS.RECORD_LINE, []);
  backupRecordLine(line);
  saveJSON(
    STORAGE_KEYS.RECORD_LINE,
    line.filter((e) => e.date !== date),
  );
}
