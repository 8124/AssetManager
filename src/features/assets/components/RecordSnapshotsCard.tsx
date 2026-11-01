import { useMemo, useState } from 'react';
import { CalendarClock, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { formatCurrencyCNY, type IRecordLineEntry } from '@/domain/asset';
import {
  deleteRecordLineEntry,
  updateRecordLineEntry,
} from '../hooks';

interface RecordSnapshotsCardProps {
  recordLine: IRecordLineEntry[];
}

interface EditingState {
  prevDate: string;
  date: string;
  /** 类别 → 金额输入框文本 */
  amounts: Record<string, string>;
}

export default function RecordSnapshotsCard({
  recordLine,
}: RecordSnapshotsCardProps) {
  // 最新日期在最上面
  const sorted = useMemo(
    () => [...recordLine].sort((a, b) => b.date.localeCompare(a.date)),
    [recordLine],
  );

  const [listOpen, setListOpen] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [deleting, setDeleting] = useState<IRecordLineEntry | null>(null);

  const openEdit = (entry: IRecordLineEntry) => {
    const amounts: Record<string, string> = {};
    for (const [cat, val] of Object.entries(entry.categories)) {
      amounts[cat] = String(val);
    }
    setEditing({ prevDate: entry.date, date: entry.date, amounts });
  };

  const handleAmountChange = (cat: string, text: string) => {
    setEditing((prev) =>
      prev ? { ...prev, amounts: { ...prev.amounts, [cat]: text } } : prev,
    );
  };

  const editingTotal = useMemo(() => {
    if (!editing) return 0;
    let sum = 0;
    for (const text of Object.values(editing.amounts)) {
      const n = parseFloat(text);
      if (!Number.isNaN(n)) sum += n;
    }
    return +sum.toFixed(2);
  }, [editing]);

  const handleSaveEdit = () => {
    if (!editing) return;
    if (!editing.date) {
      toast.error('请选择日期');
      return;
    }
    const categories: Record<string, number> = {};
    for (const [cat, text] of Object.entries(editing.amounts)) {
      const n = parseFloat(text);
      if (!Number.isNaN(n) && n > 0) {
        categories[cat] = +n.toFixed(2);
      }
    }
    const next: IRecordLineEntry = {
      date: editing.date,
      categories,
      tolamount: +Object.values(categories)
        .reduce((s, v) => s + v, 0)
        .toFixed(2),
    };
    try {
      updateRecordLineEntry(editing.prevDate, next);
      toast.success('快照已更新');
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleting) return;
    deleteRecordLineEntry(deleting.date);
    toast.success(`${deleting.date} 的快照已删除`);
    setDeleting(null);
  };

  return (
    <>
      {/* 与其他统计卡片统一：点击打开快照列表弹窗 */}
      <StatCard
        label="记录条数"
        value={sorted.length}
        icon={CalendarClock}
        accent="text-[#5AC8FA]"
        bg="bg-[#5AC8FA]/10"
        clickable
        onClick={() => setListOpen(true)}
      />

      {/* 快照列表弹窗 */}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border/40">
            <DialogTitle className="text-base">日期快照</DialogTitle>
            <DialogDescription>
              共 {sorted.length} 条快照，可修改或删除对应日期的数据
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            {sorted.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                暂无快照数据
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {sorted.map((entry) => (
                  <li
                    key={entry.date}
                    className="flex items-center gap-2 py-2.5"
                  >
                    <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                      {entry.date}
                    </span>
                    <span className="ml-auto text-sm font-semibold tabular-nums truncate">
                      {formatCurrencyCNY(entry.tolamount)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full shrink-0"
                      onClick={() => openEdit(entry)}
                      aria-label="编辑快照"
                    >
                      <Edit2 className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full text-[#FF3B30] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 shrink-0"
                      onClick={() => setDeleting(entry)}
                      aria-label="删除快照"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑快照对话框 */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>编辑日期快照</DialogTitle>
            <DialogDescription>
              修改该日期下各资产类别的金额，保存后图表与列表同步更新
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="snapshot-date">日期</Label>
                <Input
                  id="snapshot-date"
                  type="date"
                  value={editing.date}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev ? { ...prev, date: e.target.value } : prev,
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>各类别金额（人民币）</Label>
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {Object.keys(editing.amounts).length === 0 && (
                    <p className="text-xs text-muted-foreground">该快照暂无类别数据</p>
                  )}
                  {Object.entries(editing.amounts).map(([cat, text]) => (
                    <div key={cat} className="flex items-center gap-2">
                      <span className="text-sm w-20 truncate" title={cat}>
                        {cat}
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={text}
                        onChange={(e) => handleAmountChange(cat, e.target.value)}
                        placeholder="留空则清除该类别"
                        className="tabular-nums"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                <span className="text-xs text-muted-foreground">合计</span>
                <span className="text-sm font-bold tabular-nums">
                  {formatCurrencyCNY(editingTotal)}
                </span>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditing(null)}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  className="bg-[#007AFF] hover:bg-[#0066CC]"
                  onClick={handleSaveEdit}
                >
                  保存修改
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除快照</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除
              <span className="font-semibold text-foreground mx-1">
                {deleting?.date}
              </span>
              的资产快照（{deleting ? formatCurrencyCNY(deleting.tolamount) : ''}
              ）吗？该日期将从趋势图与占比图中移除，此操作不可撤销。
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
