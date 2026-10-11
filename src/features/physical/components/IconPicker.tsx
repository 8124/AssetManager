import { Label } from '@/components/ui/label';
import {
  PRESET_ICONS,
  type IPhysicalIcon,
} from '@/domain/physical';

interface IconPickerProps {
  value?: IPhysicalIcon;
  onChange: (icon: IPhysicalIcon | undefined) => void;
  bgColor?: string;
  iconColor?: string;
}

export default function IconPicker({ value, onChange, bgColor = '#E5E5EA', iconColor = '#8E8E93' }: IconPickerProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">物品图标（可选）</Label>

      {/* 预设图标网格 */}
      <div className="grid grid-cols-4 gap-2">
        {PRESET_ICONS.map((item) => {
          const Icon = item.icon;
          const isActive = value?.type === 'preset' && value.presetKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                onChange({ type: 'preset', presetKey: item.key })
              }
              className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border transition-all ${
                isActive
                  ? 'border-[#007AFF] bg-[#007AFF]/10 ring-1 ring-[#007AFF]/30'
                  : 'border-border/60 bg-white hover:border-border hover:bg-muted/30'
              }`}
            >
              <Icon
                className="size-5"
                strokeWidth={1.8}
                style={{ color: isActive ? '#007AFF' : iconColor }}
              />
              <span
                className={`text-[11px] ${
                  isActive ? 'text-[#007AFF] font-medium' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
