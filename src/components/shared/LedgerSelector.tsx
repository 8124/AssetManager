import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  ChevronDown,
  Plus,
  FolderOpen,
  Pencil,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { localFileStore, type ILedgerMeta } from '@/store/localFileStore';

export default function LedgerSelector() {
  const [activeLedger, setActiveLedger] = useState<ILedgerMeta | null>(
    localFileStore.getActiveLedger(),
  );
  const [ledgers, setLedgers] = useState<ILedgerMeta[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // 重命名弹窗
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ILedgerMeta | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<ILedgerMeta | null>(null);

  // 订阅活跃账本变化（切换、重命名等）
  useEffect(() => {
    return localFileStore.subscribe(() => {
      setActiveLedger(localFileStore.getActiveLedger());
    });
  }, []);

  // 下拉打开时刷新账本列表
  const refreshList = useCallback(async () => {
    try {
      const list = await localFileStore.listLedgers();
      setLedgers(list);
    } catch {
      setLedgers([]);
    }
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      refreshList();
    }
  };

  /* ---------- 切换账本 ---------- */
  const handleSwitch = async (id: string) => {
    if (id === activeLedger?.id) return;
    setSwitchingId(id);
    try {
      await localFileStore.switchLedger(id);
      toast.success('账本已切换');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '切换账本失败');
    } finally {
      setSwitchingId(null);
    }
  };

  /* ---------- 新建账本 ---------- */
  const handleCreate = () => {
    setOpen(false);
    // createLedger 不再弹出文件选择器：直接创建空账本，数据存本地快照
    localFileStore
      .createLedger()
      .then(() => toast.success('新账本已创建'))
      .catch((err: { name?: string; message?: string }) => {
        if (err?.name !== 'AbortError') {
          toast.error(err?.message || '创建账本失败');
        }
      });
  };

  /* ---------- 打开已有账本 ---------- */
  const handleOpenFile = () => {
    setOpen(false);
    localFileStore
      .openLedgerFile()
      .then(() => toast.success('账本已加载'))
      .catch((err: { name?: string; message?: string }) => {
        if (err?.name !== 'AbortError') {
          toast.error(err?.message || '打开账本失败');
        }
      });
  };

  /* ---------- 重命名 ---------- */
  const handleRenameClick = (ledger: ILedgerMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameTarget(ledger);
    setRenameValue(ledger.name);
    setRenameOpen(true);
  };

  const handleRenameConfirm = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error('账本名称不能为空');
      return;
    }
    try {
      await localFileStore.renameLedger(renameTarget.id, name);
      toast.success('账本已重命名');
      setRenameOpen(false);
      refreshList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '重命名失败');
    }
  };

  /* ---------- 删除 ---------- */
  const handleDeleteClick = (ledger: ILedgerMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(ledger);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await localFileStore.deleteLedger(deleteTarget.id);
      toast.success('账本已删除');
      setDeleteTarget(null);
      refreshList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const displayName = activeLedger?.name || '账本';

  return (
    <>
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/60 hover:bg-white border border-border/40 text-sm font-medium text-foreground transition-colors max-w-[180px]"
            title={displayName}
          >
            <BookOpen className="size-4 text-[#007AFF] shrink-0" />
            <span className="truncate">{displayName}</span>
            <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            我的账本
          </DropdownMenuLabel>

          {ledgers.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              暂无账本
            </div>
          ) : (
            ledgers.map((ledger) => {
              const isActive = ledger.id === activeLedger?.id;
              const isSwitching = switchingId === ledger.id;
              return (
                <div key={ledger.id} className="group relative">
                  <DropdownMenuItem
                    onClick={() => handleSwitch(ledger.id)}
                    className="pr-16 cursor-pointer"
                    disabled={isSwitching}
                  >
                    {isSwitching ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : isActive ? (
                      <Check className="size-4 text-[#007AFF]" />
                    ) : (
                      <span className="size-4" />
                    )}
                    <span className="truncate flex-1">{ledger.name}</span>
                  </DropdownMenuItem>
                  {/* 悬停操作按钮 */}
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleRenameClick(ledger, e)}
                      className="size-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                      title="重命名"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(ledger, e)}
                      className="size-7 flex items-center justify-center rounded-md hover:bg-[#FF3B30]/10 text-muted-foreground hover:text-[#FF3B30]"
                      title="删除"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleCreate} className="cursor-pointer gap-2">
            <Plus className="size-4 text-[#007AFF]" />
            <span>新建账本</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleOpenFile} className="cursor-pointer gap-2">
            <FolderOpen className="size-4 text-[#007AFF]" />
            <span>打开已有账本</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 重命名弹窗 */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>重命名账本</DialogTitle>
            <DialogDescription>
              输入新的账本名称，仅修改显示名称，不影响文件名。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="账本名称"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameConfirm();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleRenameConfirm}
              className="bg-[#007AFF] hover:bg-[#0066CC]"
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除账本</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除账本「
              <span className="font-semibold text-foreground">
                {deleteTarget?.name}
              </span>
              」吗？此操作仅从列表中移除，不会删除本地 JSON 文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-[#FF3B30] hover:bg-[#D70015]"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
