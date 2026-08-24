import { useState, useMemo } from 'react';
import { Edit2, Trash2, ArrowUpDown, Filter, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Input } from '@/components/ui/input';
import { IAssetRecord, formatCurrencyCNY, formatAssetLabel } from '@/data/asset';

interface RecordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: IAssetRecord[];
  categories: string[];
  onEdit: (record: IAssetRecord) => void;
  onDelete: (id: string) => void;
}

type SortOrder = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export default function RecordsDialog({
  open,
  onOpenChange,
  records,
  categories,
  onEdit,
  onDelete,
}: RecordsDialogProps) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('date-desc');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<IAssetRecord | null>(null);

  const filteredRecords = useMemo(() => {
    let list = [...records];

    if (categoryFilter !== 'all') {
      list = list.filter((r) => r.category === categoryFilter);
    }

    const keyword = searchKeyword.trim().toLowerCase();
    if (keyword) {
      list = list.filter(
        (r) =>
          r.category.toLowerCase().includes(keyword) ||
          (r.name ?? '').toLowerCase().includes(keyword),
      );
    }

    switch (sortOrder) {
      case 'date-desc':
        list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
        break;
      case 'date-asc':
        list.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
        break;
      case 'amount-desc':
        list.sort((a, b) => b.amountCNY - a.amountCNY);
        break;
      case 'amount-asc':
        list.sort((a, b) => a.amountCNY - b.amountCNY);
        break;
    }

    return list;
  }, [records, categoryFilter, sortOrder, searchKeyword]);

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      onDelete(deleteTarget.id);
      toast.success('资产记录已删除');
      setDeleteTarget(null);
    }
  };

  const handleEdit = (record: IAssetRecord) => {
    onOpenChange(false);
    onEdit(record);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[820px] max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base">资产记录</DialogTitle>
                <DialogDescription>
                  共 {records.length} 条资产记录
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* 筛选工具栏 */}
          <div className="px-6 py-3 border-b border-border/40 flex items-center gap-2 flex-wrap bg-muted/30">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索资产名称/类别"
                className="w-48 pl-7 h-8 text-sm"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="size-3.5 text-muted-foreground" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-28 h-8 text-sm">
                  <SelectValue placeholder="全部类别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类别</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <ArrowUpDown className="size-3.5 text-muted-foreground" />
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">日期从新到旧</SelectItem>
                  <SelectItem value="date-asc">日期从旧到新</SelectItem>
                  <SelectItem value="amount-desc">金额从高到低</SelectItem>
                  <SelectItem value="amount-asc">金额从低到高</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 表格区 */}
          <div className="flex-1 overflow-y-auto px-6 py-2">
            {filteredRecords.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Search className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">暂无记录</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {records.length === 0
                    ? '添加第一条资产记录吧'
                    : '没有符合筛选条件的记录'}
                </p>
              </div>
            ) : (
              <div className="w-full">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="whitespace-nowrap min-w-[180px]">资产名称 · 类别</TableHead>
                      <TableHead className="whitespace-nowrap">原始金额</TableHead>
                      <TableHead className="whitespace-nowrap">人民币金额</TableHead>
                      <TableHead className="whitespace-nowrap">日期</TableHead>
                      <TableHead className="whitespace-nowrap text-right pr-2">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm truncate max-w-[240px]" title={record.name}>
                              {record.name}
                            </span>
                            <Badge
                              variant="secondary"
                              className="w-fit font-normal text-[11px] bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/10"
                            >
                              {record.category}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {record.currency === 'CNY' ? '¥' : '$'}
                          {record.amount.toLocaleString('zh-CN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="tabular-nums font-medium text-sm">
                          {formatCurrencyCNY(record.amountCNY)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {record.date}
                        </TableCell>
                        <TableCell className="text-right pr-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full"
                              onClick={() => handleEdit(record)}
                              aria-label="编辑"
                            >
                              <Edit2 className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full text-[#FF3B30] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10"
                              onClick={() => setDeleteTarget(record)}
                              aria-label="删除"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条
              <span className="font-semibold text-foreground mx-1">
                {formatAssetLabel(deleteTarget ?? { name: '', category: '' })}
              </span>
              资产记录吗？此操作不可撤销。
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
