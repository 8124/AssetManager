import { useMemo, useState } from 'react';
import { CalendarClock, Edit2, Trash2, Plus, X } from 'lucide-react';
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
import {
  evalSimpleExpression,
  formatCurrencyCNY,
  todayString,
  type IRecordLineEntry,
} from '@/domain/asset';
import { deleteRecordLineEntry, updateRecordLineEntry } from '../hooks';

interface RecordSnapshotsCardProps {
  recordLine: IRecordLineEntry[];
}

interface EditingState {
  prevDate: string;
  date: string;
  /** 类别 → 金额输入框文本 */
  amounts: Record<string, string>;
}

/**
 * 「记录条数」卡片：按日期展示的历史资产数据。
 *
 * 这是**唯一**能修改历史数据的入口 —— 记账表单永远只记今天，
 * 历史某天的各类别金额只能在这里调整。
 */
export default function RecordSnapshotsCard({ recordLine }: RecordSnapshotsCardProps) {
  // 最新日期在最上面
  const sorted = useMemo(
    () => [...recordLine].sort((a, b) => b.date.localeCompare(a.date)),
    [recordLine],
  );

  const [listOpen, setListOpen] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [deleting, setDeleting] = useState<IRecordLineEntry | null>(null);
  const [newCategory, setNewCategory] = useState('');

  const today = todayString();

  const openEdit = (entry: IRecordLineEntry) => {
    const amounts: Record<string, string> = {};
    for (const [cat, val] of Object.entries(entry.categories)) {
      amounts[cat] = String(val);
    }
    setEditing({ prevDate: entry.date, date: entry.date, amounts });
    setNewCategory('');
  };

  const handleAmountChange = (cat: string, text: string) => {
    setEditing((prev) =>
      prev ? { ...prev, amounts: { ...prev.amounts, [cat]: text } } : prev,
    );
  };

  /** 失焦时解析 + - 表达式，非法则回退为原值 */
  const handleAmountBlur = (cat: string) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const text = prev.amounts[cat];
      if (!text?.trim()) return prev;
      const result = evalSimpleExpression(text);
      if (isNaN(result)) return prev;
      return { ...prev, amounts: { ...prev.amounts, [cat]: String(result) } };
    });
  };

  const handleRemoveCategory = (cat: string) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const amounts = { ...prev.amounts };
      delete amounts[cat];
      return { ...prev, amounts };
    });
  };

  const handleAddCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    if (editing && name in editing.amounts) {
      toast.error('该类别已存在');
      return;
    }
    setEditing((prev) =>
      prev ? { ...prev, amounts: { ...prev.amounts, [name]: '' } } : prev,
    );
    setNewCategory('');
  };

  const editingTotal = useMemo(() => {
    if (!editing) return 0;
    let sum = 0;
    for (const text of Object.values(editing.amounts)) {
      const n = evalSimpleExpression(text);
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
      const n = evalSimpleExpression(text);
      if (!Number.isNaN(n) && n > 0) {
        categories[cat] = +n.toFixed(2);
      }
    }
    if (Object.keys(categories).length === 0) {
      toast.error('至少需要填写一个类别的金额');
      return;
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
      toast.success('历史数据已更新');
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleting) return;
    deleteRecordLineEntry(deleting.date);
    toast.success(`${deleting.date} 的数据已删除`);
    setDeleting(null);
  };

  return (
    <>
      {/* 与其他统计卡片统一：点击打开历史数据弹窗 */}
      <StatCard
        label="记录条数"
        value={sorted.length}
        icon={CalendarClock}
        accent="text-[#5AC8FA]"
        bg="bg-[#5AC8FA]/10"
        clickable
        onClick={() => setListOpen(true)}
      />

      {/* 历史数据列表弹窗 */}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border/40">
            <DialogTitle className="text-base">历史数据</DialogTitle>
            <DialogDescription>
              共 {sorted.length} 天记录；可修改历史某天的各类别金额。今天的数据随「当前持仓」自动更新
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            {sorted.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                还没有任何记录，记一笔后这里会出现今天的数据
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {sorted.map((entry) => {
                  // 今天的数据由「当前持仓」自动汇总，不在这里改
                  const isToday = entry.date === today;
                  return (
                    <li key={entry.date} className="flex items-center gap-2 py-2.5">
                      <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                        {entry.date}
                      </span>
                      {isToday && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#007AFF]/10 text-[#007AFF] font-medium shrink-0">
                          今天
                        </span>
                      )}
                      <span
                        className={`ml-auto text-sm tabular-nums truncate ${
                          isToday ? 'text-muted-foreground' : 'font-semibold'
                        }`}
                      >
                        {formatCurrencyCNY(entry.tolamount)}
                      </span>
                      {isToday ? (
                        // 今天的数据不可在此编辑，占位保持与其它行的金额右对齐
                        <span aria-hidden className="w-[72px] shrink-0" />
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full shrink-0"
                            onClick={() => openEdit(entry)}
                            aria-label="编辑该日数据"
                          >
                            <Edit2 className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-[#FF3B30] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 shrink-0"
                            onClick={() => setDeleting(entry)}
                            aria-label="删除该日数据"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑历史日期数据 */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>修改历史数据</DialogTitle>
            <DialogDescription>
              调整该日期下各资产类别的金额，保存后柱状图与变化图同步更新
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
                  max={today}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev ? { ...prev, date: e.target.value } : prev,
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>各类别金额（人民币，支持 + - 运算）</Label>
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {Object.keys(editing.amounts).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      该日暂无类别数据，请在下方添加
                    </p>
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
                        onBlur={() => handleAmountBlur(cat)}
                        placeholder="留空则不计入"
                        className="tabular-nums"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-[#FF3B30] shrink-0"
                        onClick={() => handleRemoveCategory(cat)}
                        aria-label={`移除 ${cat}`}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 添加类别 */}
              <div className="flex items-center gap-2">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="添加类别，如：现金"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={handleAddCategory}>
                  <Plus className="size-4 mr-1" />
                  添加
                </Button>
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
            <AlertDialogTitle>确认删除该日数据</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除
              <span className="font-semibold text-foreground mx-1">
                {deleting?.date}
              </span>
              的资产数据（{deleting ? formatCurrencyCNY(deleting.tolamount) : ''}
              ）吗？该日期将从柱状图与变化图中移除，此操作不可撤销。
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
