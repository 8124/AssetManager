import { useState, useEffect } from 'react';
import { DollarSign, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { localFileStore } from '@/store/localFileStore';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import LedgerSelector from '@/components/shared/LedgerSelector';

/**
 * 顶部导航栏：Logo + 账本选择器 + 汇率显示 + 保存（下载 JSON 副本）。
 * 汇率由 useExchangeRate 每天自动更新，此处仅展示，不提供手动刷新。
 */
export default function AppHeader() {
  const { rateInfo } = useExchangeRate();
  const [dirty, setDirty] = useState(localFileStore.isDirty());

  useEffect(() => {
    return localFileStore.subscribe(() => {
      setDirty(localFileStore.isDirty());
    });
  }, []);

  /* ---------- 保存（下载 JSON 副本） ---------- */
  const handleExport = () => {
    const fileName = localFileStore.exportToDownload();
    toast.success(`已保存为 JSON 文件：${fileName}`);
  };

  const updatedTime = format(rateInfo.updatedAt, 'MM-dd HH:mm', { locale: zhCN });

  return (
    <header className="w-full border-b border-border/40 bg-white/70 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-3">
        {/* 左侧：Logo + 账本选择器 */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-[#007AFF] flex items-center justify-center shadow-sm shrink-0">
            <DollarSign className="size-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col min-w-0">
            <LedgerSelector />
            <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
              {localFileStore.getFileName()
                ? `文件：${localFileStore.getFileName()}`
                : '本地存储 · 隐私安全'}
            </p>
          </div>
        </div>

        {/* 右侧：汇率 + 操作按钮 */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 汇率信息（桌面端显示） */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-medium text-foreground tabular-nums">
              USD/CNY · {rateInfo.rate.toFixed(4)}
            </span>
            <span className="text-[10px] text-muted-foreground">更新于 {updatedTime}</span>
          </div>

          {/* 保存：下载 JSON 副本（走下载管理器，不产生 crswap） */}
          <Button
            size="icon"
            variant="secondary"
            className="rounded-full relative"
            onClick={handleExport}
            aria-label="保存为 JSON 文件"
            title={dirty ? '有未保存改动，点击保存（下载 JSON 副本）' : '保存（下载 JSON 副本）'}
          >
            <Download className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
