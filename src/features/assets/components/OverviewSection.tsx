import { Wallet, Shapes, Clock, CalendarRange, TrendingUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/StatCard';
import { formatMonthDay, formatNumber } from '@/lib/format';
import type { IRecordLineEntry } from '@/domain/asset';
import RecordSnapshotsCard from './RecordSnapshotsCard';

interface OverviewSectionProps {
  totalCNY: number;
  /** 资产种类数（去重后的类别数量） */
  categoryCount: number;
  latestDate: string;
  /** 上一次更新的日期（YYYY-MM-DD）；无可对比数据时为 null */
  prevDate: string | null;
  growthPct: number;
  /** 最近更新相对上一次更新的金额变化（人民币）；无可对比数据时为 null */
  growthAmount: number | null;
  /** 今年平均资产（人民币），无本年度数据时为 null */
  yearAvg: number | null;
  /** 今年变化（本年度最后一笔快照总额 − 第一笔），无可比较数据时为 null */
  yearChange: number | null;
  /** 按日期聚合的资产快照列表（趋势图 / 快照列表数据源） */
  recordLine: IRecordLineEntry[];
  onAddClick: () => void;
  onRecordsClick: () => void;
}

export default function OverviewSection({
  totalCNY,
  categoryCount,
  latestDate,
  prevDate,
  growthPct,
  growthAmount,
  yearAvg,
  yearChange,
  recordLine,
  onAddClick,
  onRecordsClick,
}: OverviewSectionProps) {
  const formatTotal = (val: number) => formatNumber(val, 2, 2);

  return (
    <section className="w-full mb-4 md:mb-5">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">资产总览</h2>

          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onAddClick}
              size="sm"
              className="bg-[#007AFF] hover:bg-[#0066CC] shadow-sm"
            >
              <Plus className="size-3.5 mr-1.5" />
              记一笔
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {/* 总资产 */}
          <StatCard
            label="总资产"
            value={`¥ ${formatTotal(totalCNY)}`}
            icon={Wallet}
            accent="text-[#007AFF]"
            bg="bg-[#007AFF]/10"
          />

          {/* 资产种类（去重后的类别数量） */}
          <StatCard
            label="资产种类"
            value={`${categoryCount}`}
            icon={Shapes}
            accent="text-[#34C759]"
            bg="bg-[#34C759]/10"
            clickable
            onClick={onRecordsClick}
          />

          {/* 最近更新：较上一次记录的幅度 · 金额 */}
          <StatCard
            label={
              latestDate
                ? `较 ${prevDate ? formatMonthDay(prevDate) : '—'}`
                : undefined
            }
            value={
              latestDate
                ? growthAmount != null
                  ? (
                      <>
                        {growthAmount >= 0 ? '+' : '-'}¥{formatTotal(Math.abs(growthAmount))}
                        <span className="ml-1.5 text-base md:text-lg font-bold opacity-70">
                          （{Math.abs(growthPct).toFixed(1)}%）
                        </span>
                      </>
                    )
                  : '—'
                : '暂无数据'
            }
            valueClass={
              latestDate
                ? growthPct > 0
                  ? 'text-[#FF3B30]'
                  : growthPct < 0
                    ? 'text-[#34C759]'
                    : 'text-foreground'
                : 'text-xs text-muted-foreground font-normal'
            }
            icon={Clock}
            accent="text-[#FF9500]"
            bg="bg-[#FF9500]/10"
          />
        </div>

        {/* 第二行：今年平均资产 + 今年变化 + 日期快照列表 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mt-3 md:mt-4">
          <StatCard
            label="今年平均资产"
            value={yearAvg != null ? `¥ ${formatTotal(yearAvg)}` : '—'}
            icon={CalendarRange}
            accent="text-[#AF52DE]"
            bg="bg-[#AF52DE]/10"
          />

          {/* 今年变化：本年度最后一笔快照 − 第一笔快照 */}
          <StatCard
            label="今年变化"
            value={
              yearChange != null
                ? `${yearChange >= 0 ? '+' : '-'}¥${formatTotal(Math.abs(yearChange))}`
                : '—'
            }
            valueClass={
              yearChange == null
                ? 'text-xs text-muted-foreground font-normal'
                : yearChange > 0
                  ? 'text-[#FF3B30]'
                  : yearChange < 0
                    ? 'text-[#34C759]'
                    : 'text-foreground'
            }
            icon={TrendingUp}
            accent="text-[#5AC8FA]"
            bg="bg-[#5AC8FA]/10"
          />

          {/* 日期快照列表：条数 = recordline 条数，支持修改 / 删除对应日期数据 */}
          <RecordSnapshotsCard recordLine={recordLine} />
        </div>
      </div>
    </section>
  );
}
