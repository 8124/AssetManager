import { Package, DollarSign, Clock } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { formatNumber } from '@/lib/format';

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
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-5">
      <StatCard
        label="实物总价值"
        value={`¥ ${formatNumber(totalValue, 1, 1)}`}
        icon={DollarSign}
        accent="text-[#34C759]"
        bg="bg-[#34C759]/10"
        heightClass="h-[100px]"
      />
      <StatCard
        label="实物数量"
        value={`${itemCount}`}
        icon={Package}
        accent="text-[#007AFF]"
        bg="bg-[#007AFF]/10"
        heightClass="h-[100px]"
        clickable={!!onItemCountClick}
        onClick={onItemCountClick}
      />
      <StatCard
        label="每日使用成本"
        value={`¥ ${formatNumber(dailyTotalCost, 1, 1)}/天`}
        icon={Clock}
        accent="text-[#FF9500]"
        bg="bg-[#FF9500]/10"
        heightClass="h-[100px]"
      />
    </div>
  );
}
