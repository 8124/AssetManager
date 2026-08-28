import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  /** 卡片主标题（辅助说明文字） */
  label?: ReactNode;
  /** 卡片数值（可为字符串或任意节点） */
  value?: ReactNode;
  /** 右侧图标 */
  icon?: LucideIcon;
  /** 图标颜色（text-* 类） */
  accent?: string;
  /** 图标背景色（bg-* 类） */
  bg?: string;
  /** 数值附加样式（如涨跌颜色） */
  valueClass?: string;
  /** 卡片高度，默认 h-[120px] */
  heightClass?: string;
  /** 是否可点击（带 hover 动效） */
  clickable?: boolean;
  onClick?: () => void;
}

/**
 * 统一统计卡片：图标 + 标题 + 数值的 iOS 风格布局。
 * 资产总览 / 实物统计等所有「指标卡片」复用此组件，保证界面一致。
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  bg,
  valueClass = 'text-foreground',
  heightClass = 'h-[120px]',
  clickable = false,
  onClick,
}: StatCardProps) {
  return (
    <Card
      className={`${heightClass} border-border/40 bg-white shadow-sm transition-all ${
        clickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-5 h-full flex flex-col justify-center">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {label && (
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
            )}
            {value !== undefined && value !== null && (
              <p
                className={`mt-1.5 text-xl md:text-2xl font-bold tracking-tight tabular-nums truncate ${valueClass}`}
              >
                {value}
              </p>
            )}
          </div>
          {Icon && (
            <div
              className={`size-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}
            >
              <Icon className={`size-5 ${accent}`} strokeWidth={2} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
