import { useState, useMemo } from 'react';
import { Edit2, Trash2, ArrowUpDown, Search } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
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
import ItemIcon from './ItemIcon';
import {
  type IPhysicalItem,
  calcCostPerDay,
  calcHeldDays,
} from '@/data/physical';

interface PhysicalListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: IPhysicalItem[];
  onEdit: (item: IPhysicalItem) => void;
  onDelete: (id: string) => void;
}

type SortOrder = 'date-desc' | 'date-asc' | 'price-desc' | 'price-asc' | 'daily-desc' | 'daily-asc';

export default function PhysicalListDialog({
  open,
  onOpenChange,
  items,
  onEdit,
  onDelete,
}: PhysicalListDialogProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('date-desc');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<IPhysicalItem | null>(null);

  const filteredItems = useMemo(() => {
    let list = [...items];

    const keyword = searchKeyword.trim().toLowerCase();
    if (keyword) {
      list = list.filter((i) => i.name.toLowerCase().includes(keyword));
    }

    switch (sortOrder) {
      case 'date-desc':
        list.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
        break;
      case 'date-asc':
        list.sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'daily-desc':
        list.sort((a, b) => calcCostPerDay(b.price, b.purchaseDate) - calcCostPerDay(a.price, a.purchaseDate));
        break;
      case 'daily-asc':
        list.sort((a, b) => calcCostPerDay(a.price, a.purchaseDate) - calcCostPerDay(b.price, b.purchaseDate));
        break;
    }
    return list;
  }, [items, searchKeyword, sortOrder]);

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      onDelete(deleteTarget.id);
      toast.success(`已删除「${deleteTarget.name}」`);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[820px] max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border/40 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base">实物列表</DialogTitle>
                <DialogDescription>共 {items.length} 件实物</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* 筛选工具栏 */}
          <div className="px-6 py-3 border-b border-border/40 flex items-center gap-2 flex-wrap bg-muted/30 shrink-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索物品名称"
                className="w-48 pl-7 h-8 text-sm"
              />
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
                  <SelectItem value="price-desc">价格从高到低</SelectItem>
                  <SelectItem value="price-asc">价格从低到高</SelectItem>
                  <SelectItem value="daily-desc">日均从高到低</SelectItem>
                  <SelectItem value="daily-asc">日均从低到高</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 表格区 */}
          <div className="flex-1 overflow-y-auto px-6 py-2">
            {filteredItems.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Search className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">暂无实物</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchKeyword ? '没有符合搜索条件的物品' : '添加第一件物品，看看每天持有成本'}
                </p>
              </div>
            ) : (
              <div className="w-full">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="whitespace-nowrap">名称</TableHead>
                      <TableHead className="whitespace-nowrap text-right">价格</TableHead>
                      <TableHead className="whitespace-nowrap">购买日期</TableHead>
                      <TableHead className="whitespace-nowrap text-center">已持有</TableHead>
                      <TableHead className="whitespace-nowrap text-right">日均成本</TableHead>
                      <TableHead className="whitespace-nowrap text-right pr-2">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const daily = calcCostPerDay(item.price, item.purchaseDate);
                      const days = calcHeldDays(item.purchaseDate);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <ItemIcon icon={item.icon} size={32} bgColor="#007AFF15" iconColor="#007AFF" />
                              <span className="text-sm truncate max-w-[220px]" title={item.name}>
                                {item.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums text-sm text-right">
                            ¥{item.price.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.purchaseDate}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm text-center">
                            {days} 天
                          </TableCell>
                          <TableCell className="tabular-nums font-medium text-sm text-right">
                            ¥{daily.toFixed(2)}/天
                          </TableCell>
                          <TableCell className="text-right pr-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-full"
                                onClick={() => onEdit(item)}
                                aria-label="编辑"
                              >
                                <Edit2 className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-full text-[#FF3B30] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10"
                                onClick={() => setDeleteTarget(item)}
                                aria-label="删除"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deleteTarget?.name}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-[#FF3B30] hover:bg-[#D70015] text-white"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
