import { useState, useRef, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  disabled?: boolean;
  align?: 'start' | 'center' | 'end';
  maxDate?: Date;
  minDate?: Date;
  className?: string;
  id?: string;
}

/**
 * 解析多种格式的日期输入
 * 支持: 2026/8/2, 2026-08-02, 2026.8.2, 2026年8月2日, 2026/08/02
 */
function parseDateInput(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 匹配 2026/8/2, 2026-08-02, 2026.8.2, 2026年8月2日
  const match = trimmed.match(
    /(\d{4})[\/\-\.年](\d{1,2})[\/\-\.月](\d{1,2})日?/,
  );
  if (match) {
    const [, y, m, d] = match;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10) - 1;
    const day = parseInt(d, 10);
    const date = new Date(year, month, day);
    // 校验合法性（防止 2月30日 这种无效日期）
    if (
      !isNaN(date.getTime()) &&
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  // 兜底：原生 Date 解析
  const native = new Date(trimmed);
  if (!isNaN(native.getTime())) {
    return native;
  }

  return null;
}

export default function DatePicker({
  value,
  onChange,
  disabled = false,
  align = 'start',
  maxDate,
  minDate,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 同步外部 value 到输入框显示
  useEffect(() => {
    setInputValue(format(value, 'yyyy年MM月dd日', { locale: zhCN }));
  }, [value]);

  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      onChange(date);
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleBlur = () => {
    // 如果日历弹窗打开中，不处理失焦（点击日历项会触发）
    if (open) return;

    const parsed = parseDateInput(inputValue);
    if (!parsed) {
      // 解析失败：恢复原值并提示
      setInputValue(format(value, 'yyyy年MM月dd日', { locale: zhCN }));
      toast.error('日期格式不正确，请重新输入');
      return;
    }

    // 校验日期范围
    if (maxDate && parsed > maxDate) {
      setInputValue(format(value, 'yyyy年MM月dd日', { locale: zhCN }));
      toast.error('不能选择未来日期');
      return;
    }
    if (minDate && parsed < minDate) {
      setInputValue(format(value, 'yyyy年MM月dd日', { locale: zhCN }));
      toast.error('日期超出可选范围');
      return;
    }

    // 解析成功：更新值 + 格式化显示
    onChange(parsed);
    setInputValue(format(parsed, 'yyyy年MM月dd日', { locale: zhCN }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  return (
    <div className={cn('relative w-full', className)}>
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="pr-10 h-10"
        placeholder="请输入日期，如 2026-08-02"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-1 top-1/2 -translate-y-1/2 size-8 hover:bg-accent"
            aria-label="打开日历"
          >
            <CalendarIcon className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleDaySelect}
            initialFocus
            toDate={maxDate}
            fromDate={minDate}
            captionLayout="label"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
