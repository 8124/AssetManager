import { Package, DollarSign, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PhysicalStatSectionProps {
  itemCount: number;
  totalValue: number;
  dailyTotalCost: number;
  onItemCountClick?: () => void;
}

export default function PhysicalStatSection({
  itemCount,
  totalValue,
  dailyTotalCost,
  onItemCountClick,
}: PhysicalStatSectionProps) {
  // 金额格式化，和上面组件保持同样格式
  const formatMoney = (val: number) => {
    return val.toLocaleString('zh-CN', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };

  const cards = [
    {
      label: '实物总价值',
      value: `¥ ${formatMoney(totalValue)}`,
      sub: '全部实物账面价值',
      icon: DollarSign,
      accent: 'text-[#34C759]',
      bg: 'bg-[#34C759]/10',
      clickable: false,
    },
    {
      label: '实物数量',
      value: `${itemCount}`,
      sub: '当前登记物品',
      icon: Package,
      accent: 'text-[#007AFF]',
      bg: 'bg-[#007AFF]/10',
      clickable: !!onItemCountClick,
      onClick: onItemCountClick,
    },
    {
      label: '日均总和',
      value: `¥ ${formatMoney(dailyTotalCost)}/天`,
      sub: '物品日均消耗成本',
      icon: Clock,
      accent: 'text-[#FF9500]',
      bg: 'bg-[#FF9500]/10',
      clickable: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.label}
            className={`border-border/40 bg-white shadow-sm ${card.clickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all' : ''}`}
            onClick={card.clickable ? card.onClick : undefined}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground tracking-tight tabular-nums truncate">
                    {card.value}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {card.sub}
                  </p>
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
  );
}