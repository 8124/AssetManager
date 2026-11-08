/**
 * 账本摘要（Ledger Digest）构建器。
 *
 * 目的：把浏览器里的人账本数据压缩成一段「模型友好」的 Markdown 文本。
 *
 * 为什么不直接把 JSON 丢给模型：
 * 1. 2B 级小模型的上下文与注意力都有限，长 JSON 会明显降低数字引用准确率；
 * 2. 原始 JSON 里 id / createdAt / source 等字段对分析毫无价值，纯属噪声；
 * 3. 这里预先算好占比、环比、集中度等派生指标，模型只需「读结论」而不用自己算。
 *
 * 同时兼顾信息完整性：类别分布、明细、快照趋势、币种、实物资产都在，并用
 * 抽样/截断策略保证摘要长度可控（默认控制在几千字内）。
 */

import { localFileStore } from '@/store/localFileStore';
import {
  computeYearAvgFromRecordLine,
  computeYearChangeFromRecordLine,
  STORAGE_KEYS,
  type IAssetRecord,
  type IExchangeRate,
  type IRecordLineEntry,
} from '@/domain/asset';
import type { IPhysicalItem } from '@/domain/physical';

/* ============ 类型 ============ */

export interface LedgerStats {
  recordCount: number;
  snapshotCount: number;
  categoryCount: number;
  totalCNY: number;
  /** 人民币原币种金额合计（未折算部分） */
  cnyAmount: number;
  /** 美元原币种金额合计（美元） */
  usdAmount: number;
  /** 美元资产折算后的人民币金额 */
  usdAmountCNY: number;
  usdPct: number;
  firstDate: string;
  lastDate: string;
  /** 最新快照相对上一快照的金额变化（无对比时为 null） */
  latestChange: number | null;
  latestChangePct: number | null;
  /** 前三大类别合计占比 */
  top3Pct: number;
  topCategory: string;
  topCategoryPct: number;
  physicalCount: number;
  physicalTotal: number;
  isEmpty: boolean;
}

export interface LedgerDigest {
  /** 给模型阅读的 Markdown 摘要 */
  markdown: string;
  stats: LedgerStats;
}

export interface DigestOptions {
  /**
   * 精简模式：只保留「已算好的结论指标 + 类别占比 + 趋势特征」，
   * 去掉逐条明细与逐期快照。
   *
   * 为什么需要：本机 MLX runner 实际上下文只有 4096，深度模式开思考后
   * 思考要吃掉 2000+ token，摘要必须压到 900 token 以内正文才写得下。
   * 代价是模型看不到单项资产列表，所以核心指标里补了"最大单项资产"。
   */
  compact?: boolean;
}

/* ============ 工具 ============ */

function money(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function signedMoney(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}${money(Math.abs(n))}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/** 把长列表降采样到大约 max 条，总是保留首尾 */
function downsample<T>(list: T[], max: number): T[] {
  if (list.length <= max) return list;
  const step = (list.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) {
    out.push(list[Math.round(i * step)]);
  }
  return out;
}

/* ============ 数据读取 ============ */

export interface RawLedger {
  records: IAssetRecord[];
  recordLine: IRecordLineEntry[];
  rate: IExchangeRate | undefined;
  physicalItems: IPhysicalItem[];
}

/** 从本地存储同步读取账本（调用方需保证 FileStoreGate 已就绪） */
export function readLedger(): RawLedger {
  return {
    records: localFileStore.get<IAssetRecord[]>(STORAGE_KEYS.RECORDS) ?? [],
    recordLine: localFileStore.get<IRecordLineEntry[]>(STORAGE_KEYS.RECORD_LINE) ?? [],
    rate: localFileStore.get<IExchangeRate>(STORAGE_KEYS.RATE) ?? undefined,
    physicalItems: localFileStore.get<IPhysicalItem[]>('physical_items') ?? [],
  };
}

/* ============ 摘要构建 ============ */

/** 明细最多逐条列出多少行，超出部分按类别汇总 */
const MAX_DETAIL_ROWS = 32;
/** 快照最多展示多少个时间点 */
const MAX_SNAPSHOT_ROWS = 36;
/** 实物资产最多列出多少条 */
const MAX_PHYSICAL_ROWS = 10;

export function buildLedgerDigest(
  raw: RawLedger = readLedger(),
  opts: DigestOptions = {},
): LedgerDigest {
  const { records, recordLine, rate, physicalItems } = raw;
  const compact = !!opts.compact;

  /* ---- 基础聚合 ---- */
  const totalCNY = records.reduce((s, r) => s + r.amountCNY, 0);

  const byCategory = new Map<string, { amount: number; count: number }>();
  for (const r of records) {
    const key = r.category?.trim() || '未分类';
    const cur = byCategory.get(key) ?? { amount: 0, count: 0 };
    cur.amount += r.amountCNY;
    cur.count += 1;
    byCategory.set(key, cur);
  }
  const categoryList = Array.from(byCategory.entries())
    .map(([category, v]) => ({
      category,
      amount: +v.amount.toFixed(2),
      count: v.count,
      share: totalCNY > 0 ? (v.amount / totalCNY) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const usdRecords = records.filter((r) => r.currency === 'USD');
  const cnyAmount = records
    .filter((r) => r.currency === 'CNY')
    .reduce((s, r) => s + r.amount, 0);
  const usdAmount = usdRecords.reduce((s, r) => s + r.amount, 0);
  const usdAmountCNY = usdRecords.reduce((s, r) => s + r.amountCNY, 0);

  const sortedSnapshots = [...recordLine].sort((a, b) => a.date.localeCompare(b.date));
  const latestSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
  const prevSnapshot = sortedSnapshots[sortedSnapshots.length - 2];

  const sortedByDate = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = sortedByDate[0]?.date ?? '';
  const lastDate = sortedByDate[sortedByDate.length - 1]?.date ?? '';

  const top3Pct = categoryList.slice(0, 3).reduce((s, c) => s + c.share, 0);

  const stats: LedgerStats = {
    recordCount: records.length,
    snapshotCount: sortedSnapshots.length,
    categoryCount: categoryList.length,
    totalCNY: +totalCNY.toFixed(2),
    cnyAmount: +cnyAmount.toFixed(2),
    usdAmount: +usdAmount.toFixed(2),
    usdAmountCNY: +usdAmountCNY.toFixed(2),
    usdPct: totalCNY > 0 ? (usdAmountCNY / totalCNY) * 100 : 0,
    firstDate,
    lastDate,
    latestChange:
      latestSnapshot && prevSnapshot
        ? +(latestSnapshot.tolamount - prevSnapshot.tolamount).toFixed(2)
        : null,
    latestChangePct:
      latestSnapshot && prevSnapshot && prevSnapshot.tolamount > 0
        ? ((latestSnapshot.tolamount - prevSnapshot.tolamount) / prevSnapshot.tolamount) * 100
        : null,
    top3Pct,
    topCategory: categoryList[0]?.category ?? '',
    topCategoryPct: categoryList[0]?.share ?? 0,
    physicalCount: physicalItems.length,
    physicalTotal: +physicalItems.reduce((s, p) => s + (p.price || 0), 0).toFixed(2),
    isEmpty: records.length === 0 && recordLine.length === 0 && physicalItems.length === 0,
  };

  /* ---- Markdown 组装 ---- */
  const lines: string[] = [];

  /**
   * 核心指标区：一次把模型需要的结论性数字全部给到位。
   * 这段存在的唯一目的是「让模型不用算」—— 缺一个数，它就会在思考里自己加半天。
   */
  const cnyPct = totalCNY > 0 ? (stats.cnyAmount / totalCNY) * 100 : 0;
  lines.push(`### 核心指标（已算好，直接引用，禁止重新计算）`);
  lines.push(
    `- 总资产：**${money(stats.totalCNY)}**（${stats.recordCount} 条资产、${stats.categoryCount} 个类别）。`,
  );
  if (categoryList[0]) {
    lines.push(
      `- 最大类别：${stats.topCategory} ${money(categoryList[0].amount)}，占 ${pct(stats.topCategoryPct)}；前三大类别合计占 ${pct(stats.top3Pct)}。`,
    );
  }
  // 精简模式下不列明细，必须在这里给出"最大单项资产"，否则模型无从回答"我最大的持仓是什么"
  if (compact) {
    const biggest = records.reduce<IAssetRecord | null>(
      (a, b) => (!a || b.amountCNY > a.amountCNY ? b : a),
      null,
    );
    if (biggest) {
      lines.push(
        `- 最大单项资产：${biggest.name || '未命名'}（${biggest.category || '未分类'}）${money(biggest.amountCNY)}，占 ${pct(stats.totalCNY > 0 ? (biggest.amountCNY / stats.totalCNY) * 100 : 0)}。`,
      );
    }
  }
  lines.push(
    `- 币种：人民币 ${money(stats.cnyAmount)}（${pct(cnyPct)}）；美元 $${stats.usdAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ≈ ${money(stats.usdAmountCNY)}（占 ${pct(stats.usdPct)}）。`,
  );
  if (rate) {
    lines.push(
      `- 汇率：1 USD = ${rate.rate.toFixed(4)} CNY（${rate.source === 'auto' ? '接口自动获取' : '用户手动设置'}，${new Date(rate.updatedAt).toLocaleString('zh-CN', { hour12: false })}），所有美元金额已按此折算。`,
    );
  }
  if (firstDate) {
    lines.push(`- 资产条目日期范围：${firstDate} ~ ${lastDate}。`);
  }
  if (latestSnapshot) {
    const latestDelta =
      stats.latestChange !== null && stats.latestChangePct !== null
        ? `，较上一期 ${signedMoney(stats.latestChange)}（${stats.latestChangePct >= 0 ? '+' : ''}${stats.latestChangePct.toFixed(1)}%）`
        : '';
    lines.push(
      `- 最新快照：${latestSnapshot.date} ${money(latestSnapshot.tolamount)}${latestDelta}（共 ${stats.snapshotCount} 期快照）。`,
    );
  }

  if (stats.isEmpty) {
    lines.push('');
    lines.push('### 注意');
    lines.push('- 该账本目前没有任何资产记录，无法做结构分析。请如实告知用户账本为空，并建议先录入资产。');
    return { markdown: lines.join('\n'), stats };
  }

  /* 类别分布（币种与集中度已在核心指标里，不重复列） */
  if (categoryList.length > 0) {
    lines.push('');
    if (compact) {
      lines.push(
        `### 类别占比\n${categoryList.map((c) => `${c.category} ${pct(c.share)}`).join('、')}`,
      );
    } else {
      lines.push('### 资产类别分布（按折算人民币金额降序）');
      for (const c of categoryList) {
        lines.push(`- ${c.category}：${money(c.amount)}，占比 ${pct(c.share)}，${c.count} 条`);
      }
    }
  }

  /* 明细（精简模式省略，deep 模式的思考预算需要留空间） */
  if (!compact && records.length > 0) {
    const sortedRecords = [...records].sort((a, b) => b.amountCNY - a.amountCNY);
    const shown = sortedRecords.slice(0, MAX_DETAIL_ROWS);
    lines.push('');
    lines.push(
      `### 资产明细${records.length > shown.length ? `（按金额降序，仅列前 ${shown.length} 条）` : '（按金额降序）'}`,
    );
    for (const r of shown) {
      const orig =
        r.currency === 'USD'
          ? `$${r.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ≈ ${money(r.amountCNY)}`
          : money(r.amount);
      lines.push(
        `- [${r.category || '未分类'}] ${r.name || '未命名'}：${orig}，日期 ${r.date}`,
      );
    }
    if (records.length > shown.length) {
      const rest = sortedRecords.slice(shown.length);
      const restTotal = rest.reduce((s, r) => s + r.amountCNY, 0);
      const restByCat = new Map<string, number>();
      for (const r of rest) {
        const k = r.category || '未分类';
        restByCat.set(k, (restByCat.get(k) ?? 0) + r.amountCNY);
      }
      const parts = Array.from(restByCat.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${money(v)}`)
        .join('、');
      lines.push(
        `- 其余 ${rest.length} 条未逐一列出，合计 ${money(restTotal)}，按类别为：${parts}。`,
      );
    }
  }

  /* 快照趋势 */
  if (sortedSnapshots.length > 0) {
    const sampled = downsample(sortedSnapshots, MAX_SNAPSHOT_ROWS);
    // 精简模式不列逐期清单与类别构成，只保留下面的"趋势特征"（结论已算好）
    if (!compact) {
      lines.push('');
      lines.push(
        `### 历史日期快照（总资产趋势${sortedSnapshots.length > sampled.length ? `，共 ${sortedSnapshots.length} 个时间点、已等距抽样 ${sampled.length} 个` : ''}）`,
      );
      sampled.forEach((s, i) => {
        const prev = i === 0 ? null : sampled[i - 1];
        let deltaText = '';
        if (prev && prev.date !== s.date) {
          const diff = s.tolamount - prev.tolamount;
          const ratio = prev.tolamount > 0 ? (diff / prev.tolamount) * 100 : 0;
          deltaText = `（较上一快照 ${signedMoney(diff)}，${ratio >= 0 ? '+' : ''}${ratio.toFixed(1)}%）`;
        }
        lines.push(`- ${s.date}：${money(s.tolamount)}${deltaText}`);
      });

      // 最新快照的类别构成，便于回答"最近一次的结构如何"
      if (latestSnapshot) {
        const cats = Object.entries(latestSnapshot.categories)
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1]);
        if (cats.length > 0) {
          const total = latestSnapshot.tolamount || cats.reduce((s, [, v]) => s + v, 0);
          lines.push(
            `- 最新快照（${latestSnapshot.date}）类别构成：${cats
              .map(([k, v]) => `${k} ${money(v)}（${pct(total > 0 ? (v / total) * 100 : 0)}）`)
              .join('、')}`,
          );
        }
      }
    }

    /* 趋势特征：预先算好，避免小模型自己推导出错 */
    if (sortedSnapshots.length >= 2) {
      const first = sortedSnapshots[0];
      const last = sortedSnapshots[sortedSnapshots.length - 1];
      const delta = last.tolamount - first.tolamount;
      const deltaPct = first.tolamount > 0 ? (delta / first.tolamount) * 100 : 0;

      let peak = sortedSnapshots[0];
      let maxDd = 0;
      let ddFrom = sortedSnapshots[0];
      let ddTo = sortedSnapshots[0];
      for (const s of sortedSnapshots) {
        if (s.tolamount > peak.tolamount) peak = s;
        const dd = peak.tolamount > 0 ? ((s.tolamount - peak.tolamount) / peak.tolamount) * 100 : 0;
        if (dd < maxDd) {
          maxDd = dd;
          ddFrom = peak;
          ddTo = s;
        }
      }
      const maxSnap = [...sortedSnapshots].reduce((a, b) => (b.tolamount > a.tolamount ? b : a));
      const minSnap = [...sortedSnapshots].reduce((a, b) => (b.tolamount < a.tolamount ? b : a));

      lines.push('');
      lines.push('### 趋势特征（已预先计算，直接引用即可，不要自行重新推导）');
      lines.push(
        `- 区间首尾：${first.date} ${money(first.tolamount)} → ${last.date} ${money(last.tolamount)}，累计 ${signedMoney(delta)}（${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%）。`,
      );
      lines.push(`- 区间最高：${maxSnap.date} ${money(maxSnap.tolamount)}；区间最低：${minSnap.date} ${money(minSnap.tolamount)}。`);
      lines.push(
        maxDd < 0
          ? `- 最大回撤：${maxDd.toFixed(1)}%（${ddFrom.date} ${money(ddFrom.tolamount)} → ${ddTo.date} ${money(ddTo.tolamount)}）。`
          : '- 最大回撤：区间内快照总额单调不减，未出现回撤。',
      );

      // 最近两个快照的类别变化，用来说明"这段时间钱主要流向了哪里"
      if (prevSnapshot && latestSnapshot) {
        const keys = new Set([
          ...Object.keys(prevSnapshot.categories),
          ...Object.keys(latestSnapshot.categories),
        ]);
        const diffs: string[] = [];
        for (const k of keys) {
          const before = prevSnapshot.categories[k] ?? 0;
          const after = latestSnapshot.categories[k] ?? 0;
          const d = after - before;
          if (Math.abs(d) >= 0.01) diffs.push(`${k} ${signedMoney(d)}`);
        }
        lines.push(
          `- 最近两个快照（${prevSnapshot.date} → ${latestSnapshot.date}）的类别余额变化：${diffs.length > 0 ? diffs.join('、') : '各类别余额无变化'}。`,
        );
      }
      lines.push(
        '- 注意：快照只记录"余额视图"，不含买卖、涨跌、转入转出等流水。上面只能说明"哪类余额变了多少"，不能推断变动原因。',
      );
    }
  }

  /* 年度指标 */
  const year = new Date().getFullYear();
  const yearAvg = computeYearAvgFromRecordLine(recordLine, year);
  const yearChange = computeYearChangeFromRecordLine(recordLine, year);
  if (yearAvg !== null || yearChange !== null) {
    lines.push('');
    lines.push(`### ${year} 年指标`);
    if (yearAvg !== null) lines.push(`- 今年平均资产（各月月末快照均值）：${money(yearAvg)}`);
    if (yearChange !== null) {
      lines.push(`- 今年变化（年内最后一笔快照 − 第一笔）：${signedMoney(yearChange)}`);
    }
  }

  /* 实物资产 */
  if (physicalItems.length > 0) {
    const sortedItems = [...physicalItems].sort((a, b) => (b.price || 0) - (a.price || 0));
    const shown = compact ? [] : sortedItems.slice(0, MAX_PHYSICAL_ROWS);
    lines.push('');
    lines.push(
      `### 实物资产（另一份清单，不计入上面的总资产；共 ${stats.physicalCount} 件，合计 ${money(stats.physicalTotal)}）`,
    );
    for (const p of shown) {
      lines.push(`- ${p.name}：${money(p.price || 0)}，购于 ${p.purchaseDate}`);
    }
    if (!compact && sortedItems.length > shown.length) {
      lines.push(`- 其余 ${sortedItems.length - shown.length} 件未列出。`);
    }
  }

  return { markdown: lines.join('\n'), stats };
}
