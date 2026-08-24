import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string;          // yyyy-MM-dd
  onChange: (date: string) => void;
  maxDate?: Date;
  placeholder?: string;
}

export default function DatePicker({ value, onChange, maxDate, placeholder }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'year'>('day');
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());

  const formatDisplay = (dateStr: string) => {
    if (!dateStr) return placeholder || '请选择日期';
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;
  };

  // 日视图：直接用 shadcn Calendar
  const renderDayView = () => (
    <Calendar
      mode="single"
      selected={value ? new Date(value) : undefined}
      onSelect={(d) => {
        if (d) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          onChange(`${yyyy}-${mm}-${dd}`);
          setOpen(false);
          setViewMode('day');
        }
      }}
      month={viewDate}
      onMonthChange={setViewDate}
      disabled={maxDate ? { after: maxDate } : undefined}
      components={{
        Caption: ({ displayMonth }) => (
          <button
            type="button"
            className="text-sm font-medium hover:underline"
            onClick={() => setViewMode('month')}
          >
            {displayMonth.getFullYear()}年{displayMonth.getMonth() + 1}月
          </button>
        ),
      }}
    />
  );

  // 月视图：12个月网格
  const renderMonthView = () => {
    const year = viewDate.getFullYear();
    const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" onClick={() => setViewDate(new Date(year - 1, viewDate.getMonth()))}>
            <ChevronLeft className="size-4" />
          </Button>
          <button className="text-sm font-medium hover:underline" onClick={() => setViewMode('year')}>
            {year}年
          </button>
          <Button variant="ghost" size="icon" onClick={() => setViewDate(new Date(year + 1, viewDate.getMonth()))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {months.map((m, i) => (
            <button
              key={m}
              className="py-2 text-sm rounded-md hover:bg-accent"
              onClick={() => {
                setViewDate(new Date(year, i, 1));
                setViewMode('day');
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // 年视图：10年一组
  const renderYearView = () => {
    const currentYear = viewDate.getFullYear();
    const startYear = Math.floor(currentYear / 10) * 10;
    const years = Array.from({ length: 12 }, (_, i) => startYear - 1 + i);
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" onClick={() => setViewDate(new Date(startYear - 10, 0))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium">{startYear} - {startYear + 9}</span>
          <Button variant="ghost" size="icon" onClick={() => setViewDate(new Date(startYear + 10, 0))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {years.map((y) => (
            <button
              key={y}
              className={`py-2 text-sm rounded-md hover:bg-accent ${y < startYear || y > startYear + 9 ? 'text-muted-foreground opacity-50' : ''}`}
              onClick={() => {
                setViewDate(new Date(y, viewDate.getMonth(), 1));
                setViewMode('month');
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal">
          {formatDisplay(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'year' && renderYearView()}
      </PopoverContent>
    </Popover>
  );
}
