import { Wallet, FileText, Clock, CalendarRange, Plus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
  onExportClick: () => void;
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
  onExportClick,
}: OverviewSectionProps) {
  const formatTotal = (val: number) => {
    return val.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // 将 "2026-08-26" 格式化为 "8月26日"
  const formatMonthDay = (d: string) => {
    const m = parseInt(d.slice(5, 7), 10);
    const day = parseInt(d.slice(8, 10), 10);
    return `${m}月${day}日`;
  };

  const cards: Array<{
    label: string;
    value: string;
    icon: typeof Wallet;
    accent: string;
    bg: string;
    onClick?: () => void;
    clickable?: boolean;
  }> = [
    {
      label: '总资产（人民币）',
      value: `¥ ${formatTotal(totalCNY)}`,
      icon: Wallet,
      accent: 'text-[#007AFF]',
      bg: 'bg-[#007AFF]/10',
    },
    {
      label: '资产记录',
      value: `${recordCount}`,
      icon: FileText,
      accent: 'text-[#34C759]',
      bg: 'bg-[#34C759]/10',
      onClick: onRecordsClick,
      clickable: true,
    },
  ];

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
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.label}
                onClick={'onClick' in card ? card.onClick : undefined}
                className={`h-[120px] border-border/40 bg-white shadow-sm transition-all ${
                  'clickable' in card && card.clickable
                    ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
                    : ''
                }`}
              >
                <CardContent className="p-5 h-full flex flex-col justify-center">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                      <p className="mt-1.5 text-xl md:text-2xl font-bold text-foreground tracking-tight tabular-nums truncate">
                        {card.value}
                      </p>
                    </div>
                    <div
                      className={`size-10 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}
                    >
                      <Icon className={`size-5 ${card.accent}`} strokeWidth={2} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* 最近更新卡片：仅显示与上次更新的对比信息（较上次日期 + 幅度·金额） */}
          <Card className="h-[120px] border-border/40 bg-white shadow-sm">
            <CardContent className="p-5 h-full flex flex-col justify-center">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {latestDate ? (
                    <>
                      <p className="text-xs font-medium text-muted-foreground">
                        较 {prevDate ? formatMonthDay(prevDate) : '—'}
                      </p>
                      <p
                        className={`mt-1.5 text-xl md:text-2xl font-bold tracking-tight tabular-nums truncate ${
                          growthPct > 0
                            ? 'text-[#FF3B30]'
                            : growthPct < 0
                              ? 'text-[#34C759]'
                              : 'text-foreground'
                        }`}
                      >
                        {growthAmount != null
                          ? `${growthPct > 0 ? '↑' : growthPct < 0 ? '↓' : ''} ${Math.abs(growthPct).toFixed(1)}% · ${growthAmount >= 0 ? '+' : '-'}¥${formatTotal(Math.abs(growthAmount))}`
                          : '—'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">暂无数据</p>
                  )}
                </div>
                <div className="size-10 rounded-xl bg-[#FF9500]/10 flex items-center justify-center shrink-0">
                  <Clock className="size-5 text-[#FF9500]" strokeWidth={2} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 第二行卡片：今年平均资产 + 预留占位卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mt-3 md:mt-4">
          <Card className="h-[120px] border-border/40 bg-white shadow-sm">
            <CardContent className="p-5 h-full flex flex-col justify-center">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">今年平均资产</p>
                  <p className="mt-1.5 text-xl md:text-2xl font-bold text-foreground tracking-tight tabular-nums truncate">
                    {yearAvg != null ? `¥ ${formatTotal(yearAvg)}` : '—'}
                  </p>
                </div>
                <div className="size-10 rounded-xl bg-[#AF52DE]/10 flex items-center justify-center shrink-0">
                  <CalendarRange className="size-5 text-[#AF52DE]" strokeWidth={2} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-[120px] border-dashed border-border/60 bg-white/60 shadow-sm">
            <CardContent className="p-5 h-full flex items-center justify-center">
              <span className="text-sm text-muted-foreground/60">待补充</span>
            </CardContent>
          </Card>

          <Card className="h-[120px] border-dashed border-border/60 bg-white/60 shadow-sm">
            <CardContent className="p-5 h-full flex items-center justify-center">
              <span className="text-sm text-muted-foreground/60">待补充</span>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
