import { useState, useEffect } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from '@/components/shared/DatePicker';
import IconPicker from './IconPicker';
import { parseDateSafe, type IPhysicalItem } from '@/domain/physical';

interface PhysicalFormDialogProps {
  open: boolean;
  mode: 'add' | 'edit';
  editingItem?: IPhysicalItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<IPhysicalItem, 'id' | 'createdAt'>) => void;
  onDelete?: (id: string) => void;
}

export default function PhysicalFormDialog({
  open,
  mode,
  editingItem,
  onOpenChange,
  onSubmit,
  onDelete,
}: PhysicalFormDialogProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
  const [icon, setIcon] = useState<IPhysicalItem['icon'] | undefined>(undefined);
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});

  // 打开时初始化（编辑模式回填数据）
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && editingItem) {
        setName(editingItem.name);
        setPrice(editingItem.price.toString());
        setPurchaseDate(parseDateSafe(editingItem.purchaseDate));
        setIcon(editingItem.icon);
      } else {
        setName('');
        setPrice('');
        setPurchaseDate(new Date());
        setIcon(undefined);
      }
      setErrors({});
    }
  }, [open, mode, editingItem]);

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { name?: string; price?: string } = {};
    if (!name.trim()) newErrors.name = '请输入实物名称';
    const priceNum = Number(price);
    if (!price || isNaN(priceNum) || priceNum <= 0) newErrors.price = '请输入有效的价格';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      name: name.trim(),
      price: priceNum,
      purchaseDate: format(purchaseDate, 'yyyy-MM-dd'),
      icon,
    });

    toast.success(mode === 'edit' ? '修改已保存' : '实物已添加');
    handleOpenChange(false);
  };

  const handleDelete = () => {
    if (editingItem && onDelete) {
      onDelete(editingItem.id);
      toast.success('物品已删除');
      handleOpenChange(false);
    }
  };

  const title = mode === 'edit' ? '编辑物品' : '新增物品';
  const submitText = mode === 'edit' ? '保存修改' : '添加';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="px-6 py-4 border-b border-border/40 sticky top-0 bg-card z-10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={() => handleOpenChange(false)}
              aria-label="关闭"
            >
              <X className="size-4" />
            </Button>
          </div>
          <DialogDescription className="sr-only">实物信息表单</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="item-name" className="text-sm font-medium">
              实物名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
              }}
              placeholder="例如：AirPods Pro"
              className={errors.name ? 'border-destructive' : ''}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-price" className="text-sm font-medium">
              实物价格（元）<span className="text-destructive">*</span>
            </Label>
            <Input
              id="item-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                if (errors.price) setErrors((p) => ({ ...p, price: undefined }));
              }}
              placeholder="0.00"
              className={errors.price ? 'border-destructive' : ''}
            />
            {errors.price && (
              <p className="text-xs text-destructive">{errors.price}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              购买日期 <span className="text-destructive">*</span>
            </Label>
            <DatePicker
              value={purchaseDate}
              onChange={setPurchaseDate}
              maxDate={new Date()}
            />
          </div>

          <IconPicker value={icon} onChange={setIcon} />

          <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
            {mode === 'edit' && onDelete && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                className="text-[#FF3B30] border-[#FF3B30]/30 hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] sm:mr-auto"
              >
                <Trash2 className="size-4 mr-1.5" />
                删除
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" className="bg-[#007AFF] hover:bg-[#0066CC]">
              {submitText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
