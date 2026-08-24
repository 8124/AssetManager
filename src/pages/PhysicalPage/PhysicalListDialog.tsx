import { useState, useMemo } from 'react';
import { Edit2, Trash2, ArrowUpDown, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
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

  const sortLabel: Record<SortOrder, string> = {
    'date-desc': '日期 ↓',
    'date-asc': '日期 ↑',
    'price-desc': '价格 ↓',
    'price-asc': '价格 ↑',
    'daily-desc': '日均 ↓',
    'daily-asc': '日均 ↑',
  };

  const cycleSort = () => {
    const orders: SortOrder[] = ['date-desc', 'date-asc', 'price-desc', 'price-asc', 'daily-desc', 'daily-asc'];
    const idx = orders.indexOf(sortOrder);
    setSortOrder(orders[(idx + 1) % orders.length]);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[720px] p-0 gap-0 max-h-[85vh] flex flex-col">
          <DialogHeader className="px-6 py-4 border-b border-border/40 shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-semibold">实物列表</DialogTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索物品名称"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="pl-8 h-8 w-48 text-sm"
                  />
                  {searchKeyword && (
                    <button
                      onClick={() => setSearchKeyword('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <Button variant="outline" size="sm" className="h-8" onClick={cycleSort}>
                  <ArrowUpDown className="size-3.5 mr-1.5" />
                  {sortLabel[sortOrder]}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                {searchKeyword ? '没有找到匹配的物品' : '暂无实物记录'}
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-12">图标</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead className="text-right">价格</TableHead>
                    <TableHead>购买日期</TableHead>
                    <TableHead className="text-center">已持有</TableHead>
                    <TableHead className="text-right">日均成本</TableHead>
                    <TableHead className="w-20 text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const daily = calcCostPerDay(item.price, item.purchaseDate);
                    const days = calcHeldDays(item.purchaseDate);
                    return (
                      <TableRow key={item.id} className="cursor-pointer hover:bg-accent/50" onClick={() => onEdit(item)}>
                        <TableCell>
                          <ItemIcon icon={item.icon} size={36} bgColor="#007AFF15" iconColor="#007AFF" />
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right tabular-nums">¥{item.price.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-muted-foreground">{item.purchaseDate}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{days} 天</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">¥{daily.toFixed(2)}/天</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)} aria-label="编辑">
                              <Edit2 className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#FF3B30] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10" onClick={() => setDeleteTarget(item)} aria-label="删除">
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
