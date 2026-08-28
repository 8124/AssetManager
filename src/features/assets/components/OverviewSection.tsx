import { Wallet, FileText, Clock, CalendarRange, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/shared/StatCard';
import { formatMonthDay, formatNumber } from '@/lib/format';

interface OverviewSectionProps {
  totalCNY: number;
  recordCount: number;
  latestDate: string;
  /** 上一次更新的日期（YYYY-MM-DD）；无可对比数据时为 null */
  prevDate: string | null;
  growthPct: number;
  /** 最近更新相对上一次更新的金额变化（人民币）；无可对比数据时为 null */
  growthAmount: number | null;
  /** 今年平均资产（人民币），无本年度数据时为 null */
  yearAvg: number | null;
  onAddClick: () => void;
  onRecordsClick: () => void;
}

export default function OverviewSection({
  totalCNY,
  recordCount,
  latestDate,
  prevDate,
  growthPct,
  growthAmount,
  yearAvg,
  onAddClick,
  onRecordsClick,
}: OverviewSectionProps) {
  const formatTotal = (val: number) => formatNumber(val, 2, 2);

  return (
    <section className="w-full mb-4 md:mb-5">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">资产总览</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              所有金额统一按人民币计价展示
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onAddClick}
              size="sm"
              className="bg-[#007AFF] hover:bg-[#0066CC] shadow-sm"
            >
              <Plus className="size-3.5 mr-1.5" />
              新增资产
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {/* 总资产 */}
          <StatCard
            label="总资产（人民币）"
            value={`¥ ${formatTotal(totalCNY)}`}
            icon={Wallet}
            accent="text-[#007AFF]"
            bg="bg-[#007AFF]/10"
          />

          {/* 资产记录（可点击打开记录列表） */}
          <StatCard
            label="资产记录"
            value={`${recordCount}`}
            icon={FileText}
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
                  ? `${growthPct > 0 ? '↑' : growthPct < 0 ? '↓' : ''} ${Math.abs(growthPct).toFixed(1)}% · ${growthAmount >= 0 ? '+' : '-'}¥${formatTotal(Math.abs(growthAmount))}`
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

        {/* 第二行：今年平均资产 + 预留占位卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mt-3 md:mt-4">
          <StatCard
            label="今年平均资产"
            value={yearAvg != null ? `¥ ${formatTotal(yearAvg)}` : '—'}
            icon={CalendarRange}
            accent="text-[#AF52DE]"
            bg="bg-[#AF52DE]/10"
          />

          {Array.from({ length: 2 }, (_, i) => (
            <Card key={i} className="h-[120px] border-dashed border-border/60 bg-white/60 shadow-sm">
              <CardContent className="p-5 h-full flex items-center justify-center">
                <span className="text-sm text-muted-foreground/60">待补充</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
