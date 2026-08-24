import { Wallet, FileText, Clock, Plus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface OverviewSectionProps {
  totalCNY: number;
  recordCount: number;
  categoryCount: number;
  latestDate: string;
  growthPct: number;
  onAddClick: () => void;
  onRecordsClick: () => void;
  onExportClick: () => void;
}

export default function OverviewSection({
  totalCNY,
  recordCount,
  categoryCount,
  latestDate,
  growthPct,
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

  const cards = [
    {
      label: '总资产（人民币）',
      value: `¥ ${formatTotal(totalCNY)}`,
      sub: `${categoryCount} 个类别`,
      icon: Wallet,
      accent: 'text-[#007AFF]',
      bg: 'bg-[#007AFF]/10',
    },
    {
      label: '资产记录更新',
      value: `${recordCount}`,
      sub: '点击查看全部',
      icon: FileText,
      accent: 'text-[#34C759]',
      bg: 'bg-[#34C759]/10',
      onClick: onRecordsClick,
      clickable: true,
    },
    {
      label: '最近更新',
      value: latestDate || '暂无数据',
      sub:
        growthPct !== 0
          ? `${growthPct > 0 ? '↑' : '↓'} ${Math.abs(growthPct).toFixed(1)}%`
          : recordCount > 0
            ? '—'
            : '快去添加第一笔吧',
      subPositive: growthPct > 0,
      icon: Clock,
      accent: 'text-[#FF9500]',
      bg: 'bg-[#FF9500]/10',
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
                className={`border-border/40 bg-white shadow-sm transition-all ${
                  'clickable' in card && card.clickable
                    ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
                    : ''
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                      <p className="text-xl md:text-2xl font-bold text-foreground tracking-tight tabular-nums truncate">
                        {card.value}
                      </p>
                      {'sub' in card && (
                        <p
                          className={`text-xs font-medium ${
                            'subPositive' in card && card.subPositive !== undefined
                              ? card.subPositive
                                ? 'text-[#FF3B30]'
                                : growthPct < 0
                                  ? 'text-[#34C759]'
                                  : 'text-muted-foreground'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {card.sub}
                        </p>
                      )}
                    </div>
                    <div
                      className={`size-10 rounded-xl ${card.bg} flex items-center justify-center shrink-0 ml-3`}
                    >
                      <Icon className={`size-5 ${card.accent}`} strokeWidth={2} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
