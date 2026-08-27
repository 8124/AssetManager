import { useState, useEffect, type ReactNode } from 'react';
import { FolderOpen, FilePlus, HardDrive, Loader2, BookOpen, Check } from 'lucide-react';
import { toast } from 'sonner';
import { localFileStore, type ILedgerMeta } from '@/data/localFileStore';

interface FileStoreGateProps {
  children: ReactNode;
}

/**
 * 文件存储门控组件
 *
 * 读取 JSON 账本后即可使用；数据改动保存在浏览器本地（localStorage 快照），
 * 点右上角「保存」下载 JSON 副本，不再原地写文件。
 */
export default function FileStoreGate({ children }: FileStoreGateProps) {
  const [ready, setReady] = useState(localFileStore.isReady());
  const [autoLoading, setAutoLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ledgers, setLedgers] = useState<ILedgerMeta[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    return localFileStore.subscribe(() => {
      setReady(localFileStore.isReady());
    });
  }, []);

  // 挂载时自动加载（从 IndexedDB 恢复活跃账本）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await localFileStore.autoLoad();
      if (!cancelled) {
        setAutoLoading(false);
        if (ok) {
          setReady(true);
        } else {
          // 自动加载失败，拉取账本列表供用户选择
          try {
            const list = await localFileStore.listLedgers();
            setLedgers(list);
          } catch {
            setLedgers([]);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSwitch = async (id: string) => {
    setSwitchingId(id);
    try {
      await localFileStore.switchLedger(id);
      toast.success('账本已加载');
      setReady(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载账本失败');
    } finally {
      setSwitchingId(null);
    }
  };

  if (ready) {
    return <>{children}</>;
  }

  if (autoLoading) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 text-[#007AFF] animate-spin" />
          <p className="text-sm text-muted-foreground">正在加载本地数据…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="size-20 rounded-2xl bg-white shadow-sm flex items-center justify-center">
            <HardDrive className="size-10 text-[#007AFF]" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-foreground mb-2">资产管家</h1>
        <p className="text-sm text-center text-muted-foreground mb-8">
          打开一个 JSON 账本即可开始；改动保存在浏览器本地，点右上角「保存」下载 JSON 副本
        </p>

        {/* 已有账本列表 */}
        {ledgers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-3 px-1">
              已有账本（点击打开）
            </p>
            <div className="space-y-1">
              {ledgers.map((ledger) => (
                <button
                  key={ledger.id}
                  onClick={() => handleSwitch(ledger.id)}
                  disabled={switchingId === ledger.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left disabled:opacity-50"
                >
                  <div className="size-8 rounded-lg bg-[#007AFF]/10 flex items-center justify-center shrink-0">
                    {switchingId === ledger.id ? (
                      <Loader2 className="size-4 text-[#007AFF] animate-spin" />
                    ) : (
                      <BookOpen className="size-4 text-[#007AFF]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {ledger.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {ledger.fileName}
                    </p>
                  </div>
                  <Check className="size-4 text-muted-foreground/40 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          {/* 新建账本 —— 直接创建空账本（不选文件），数据存本地快照 */}
          <button
            onClick={() => {
              localFileStore
                .createLedger()
                .then(() => {
                  toast.success('新账本已创建');
                  setReady(true);
                })
                .catch((err: { name?: string; message?: string }) => {
                  if (err?.name !== 'AbortError') {
                    setError(err?.message || '创建账本失败');
                  }
                });
            }}
            className="w-full flex items-center justify-center gap-2 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-lg min-h-10 px-4 text-sm font-medium transition-colors"
          >
            <FilePlus className="size-4" />
            新建账本
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">或</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* 打开已有账本文件 —— onClick 中直接调用，picker 是方法内第一行 */}
          <button
            onClick={() => {
              localFileStore
                .openLedgerFile()
                .then(() => {
                  toast.success('账本已加载');
                  setReady(true);
                })
                .catch((err: { name?: string; message?: string }) => {
                  if (err?.name !== 'AbortError') {
                    setError(err?.message || '打开账本失败');
                  }
                });
            }}
            className="w-full flex items-center justify-center gap-2 border border-border bg-white hover:bg-accent text-foreground rounded-lg min-h-10 px-4 text-sm font-medium transition-colors"
          >
            <FolderOpen className="size-4" />
            打开已有账本文件
          </button>
        </div>

        {/* JSON 格式说明 */}
        <div className="mt-6 p-4 bg-white rounded-2xl shadow-sm">
          <p className="text-xs font-medium text-foreground mb-2">账本文件格式（自动生成，无需手写）：</p>
          <pre className="text-[11px] text-muted-foreground bg-[#F2F2F7] rounded-lg p-3 overflow-x-auto leading-relaxed">
{`{
  "physical_items": [
    {
      "name": "MacAir M3",
      "price": 5858,
      "purchaseDate": "2025-05-30"
    }
  ],
  "records": [
    {
      "name": "活钱",
      "category": "现金",
      "amount": 11572,
      "date": "2026-08-22"
    }
  ]
}`}
          </pre>
          <p className="text-[10px] text-muted-foreground mt-2">
            id、折算金额、创建时间、汇率等非必要信息自动生成，无需写入
          </p>
        </div>

        {error && <p className="mt-4 text-sm text-center text-[#FF3B30]">{error}</p>}

        <p className="mt-8 text-xs text-center text-muted-foreground">
          数据会在本地自动留存，刷新不丢失；随时点右上角「保存」下载 JSON 副本（不再原地改文件，不会产生 crswap）
        </p>
      </div>
    </div>
  );
}
