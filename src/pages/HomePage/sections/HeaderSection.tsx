import { useState } from 'react';
import { DollarSign, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface HeaderSectionProps {
  rate: number;
  updatedAt: number;
  onFetchRate: () => Promise<number | void>;
}

export default function HeaderSection({ rate, updatedAt, onFetchRate }: HeaderSectionProps) {
  const [isFetching, setIsFetching] = useState(false);

  const handleFetchRate = async () => {
    setIsFetching(true);
    try {
      const result = await onFetchRate();
      if (result) {
        toast.success(`汇率已更新：1 USD = ${result.toFixed(4)} CNY`);
      }
    } catch {
      toast.error('汇率获取失败，请检查网络');
    } finally {
      setIsFetching(false);
    }
  };

  const updatedTime = format(updatedAt, 'MM-dd HH:mm', { locale: zhCN });

  return (
    <header className="w-full border-b border-border/40 bg-white/70 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-[#007AFF] flex items-center justify-center shadow-sm">
            <DollarSign className="size-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-semibold text-foreground leading-tight">资产管家</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">本地存储 · 隐私安全</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span className="text-xs font-medium text-foreground tabular-nums">
              USD/CNY · {rate.toFixed(4)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              更新于 {updatedTime}
            </span>
          </div>

          <Button
            size="icon"
            variant="secondary"
            className="rounded-full"
            onClick={handleFetchRate}
            disabled={isFetching}
            aria-label="刷新汇率"
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    </header>
  );
}
