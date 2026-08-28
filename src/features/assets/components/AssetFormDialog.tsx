import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { evalSimpleExpression, type IAssetRecord } from '@/domain/asset';
import { format } from 'date-fns';

interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  onSubmit: (data: { name: string; category: string; amount: number; currency: 'CNY' | 'USD'; date: string }) => void;
  editingRecord?: IAssetRecord | null;
  onUpdate?: (id: string, data: { name: string; category: string; amount: number; currency: 'CNY' | 'USD'; date: string }) => void;
}

export default function AssetFormDialog({
  open,
  onOpenChange,
  categories,
  onSubmit,
  editingRecord,
  onUpdate,
}: AssetFormDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0] ?? '');
  const [amountInput, setAmountInput] = useState('');
  const [currency, setCurrency] = useState<'CNY' | 'USD'>('CNY');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const isEditing = !!editingRecord;

  useEffect(() => {
    if (!open) return;
    // 编辑模式：严格保留原记录的日期，不自动改为今天
    if (editingRecord) {
      setName(editingRecord.name ?? '');
      setCategory(editingRecord.category);
      setAmountInput(editingRecord.amount.toString());
      setCurrency(editingRecord.currency);
      setDate(editingRecord.date);
    } else {
      setName('');
      setCategory(categories[0] ?? '');
      setAmountInput('');
      setCurrency('CNY');
      setDate(format(new Date(), 'yyyy-MM-dd'));
    }
    setShowNewCategory(false);
    setNewCategoryName('');
  }, [open, editingRecord, categories]);

  // 金额失焦时尝试解析表达式
  const handleAmountBlur = () => {
    if (!amountInput.trim()) return;
    const result = evalSimpleExpression(amountInput);
    if (isNaN(result)) {
      toast.error('请输入正确的金额或运算式（仅支持 + 和 -）');
      return;
    }
    if (result.toString() !== amountInput.trim()) {
      setAmountInput(result.toString());
      toast.info(`已计算：${amountInput} = ${result}`);
    }
  };

  const handleUseNewCategory = () => {
    const cname = newCategoryName.trim();
    if (!cname) {
      toast.error('请输入类别名称');
      return;
    }
    setCategory(cname);
    setNewCategoryName('');
    setShowNewCategory(false);
    toast.success(`已选择类别「${cname}」，保存记录后自动加入类别列表`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('请输入资产名称');
      return;
    }
    const amount = evalSimpleExpression(amountInput);
    if (isNaN(amount) || amount <= 0) {
      toast.error('请输入有效的金额');
      return;
    }
    if (!category) {
      toast.error('请选择资产类别');
      return;
    }

    if (isEditing && editingRecord && onUpdate) {
      onUpdate(editingRecord.id, { name: trimmedName, category, amount, currency, date });
      toast.success('资产记录已更新');
    } else {
      onSubmit({ name: trimmedName, category, amount, currency, date });
      toast.success('资产记录已保存');
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑资产记录' : '新增资产记录'}</DialogTitle>
          <DialogDescription>
            {isEditing ? '修改资产记录信息，保存后即时更新' : '填写资产信息，金额支持 + - 运算表达式'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* 资产名称 */}
          <div className="space-y-2">
            <Label htmlFor="asset-name">
              资产名称 <span className="text-[#FF3B30]">*</span>
            </Label>
            <Input
              id="asset-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：黄金、美股"
              autoFocus
            />
          </div>

          {/* 类别 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="category">资产类别</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-[#007AFF] hover:text-[#0066CC] hover:bg-transparent"
                onClick={() => setShowNewCategory(!showNewCategory)}
              >
                {showNewCategory ? '取消' : '+ 新增类别'}
              </Button>
            </div>
            {showNewCategory ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="请输入新类别名称"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleUseNewCategory();
                    }
                  }}
                />
                <Button type="button" size="sm" onClick={handleUseNewCategory}>
                  使用
                </Button>
              </div>
            ) : (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="选择类别" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 金额 */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="flex items-center gap-1.5">
              金额
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded">
                <Sparkles className="size-3" />
                支持 + - 运算
              </span>
            </Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              onBlur={handleAmountBlur}
              placeholder="例如 1000 或 500+300"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 币种 */}
            <div className="space-y-2">
              <Label>币种</Label>
              <RadioGroup
                value={currency}
                onValueChange={(v) => setCurrency(v as 'CNY' | 'USD')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CNY" id="dlg-cny" />
                  <Label htmlFor="dlg-cny" className="cursor-pointer font-normal text-sm">
                    人民币
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="USD" id="dlg-usd" />
                  <Label htmlFor="dlg-usd" className="cursor-pointer font-normal text-sm">
                    美元
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* 日期 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="dlg-date">日期</Label>
                {isEditing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-[#007AFF] hover:text-[#0066CC] hover:bg-transparent"
                    onClick={() => setDate(format(new Date(), 'yyyy-MM-dd'))}
                  >
                    设为今天
                  </Button>
                )}
              </div>
              <Input
                id="dlg-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" className="bg-[#007AFF] hover:bg-[#0066CC]">
              {isEditing ? '保存修改' : '添加记录'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
