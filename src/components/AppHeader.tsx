import { useState, useRef } from 'react';
import { DollarSign, RefreshCw, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { localFileStore } from '@/data/localFileStore';
import LedgerSelector from '@/components/LedgerSelector';

interface AppHeaderProps {
  rate: number;
  updatedAt: number;
  onFetchRate: () => Promise<number | void>;
}

export default function AppHeader({ rate, updatedAt, onFetchRate }: AppHeaderProps) {
  const [isFetching, setIsFetching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /* ---------- 导入 JSON ---------- */
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      localFileStore.importFromJSONText(text);
      toast.success(`已从「${file.name}」导入数据`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导入失败，请确认 JSON 格式正确');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ---------- 导出 JSON ---------- */
  const handleExport = () => {
    localFileStore.exportToDownload();
    toast.success('数据已导出为 JSON 文件');
  };

  const updatedTime = format(updatedAt, 'MM-dd HH:mm', { locale: zhCN });

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
              {localFileStore.getFileName() ? `文件：${localFileStore.getFileName()}` : '本地存储 · 隐私安全'}
            </p>
          </div>
        </div>

        {/* 右侧：汇率 + 操作按钮 */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 汇率信息（桌面端显示） */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-medium text-foreground tabular-nums">
              USD/CNY · {rate.toFixed(4)}
            </span>
            <span className="text-[10px] text-muted-foreground">更新于 {updatedTime}</span>
          </div>

          {/* 刷新汇率 */}
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

       
          {/* 导出 */}
          <Button
            size="icon"
            variant="secondary"
            className="rounded-full"
            onClick={handleExport}
            aria-label="导出数据"
            title="导出 JSON"
          >
            <Download className="size-4" />
          </Button>

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>
    </header>
  );
}
