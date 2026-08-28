import { useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  PRESET_ICONS,
  type IPhysicalIcon,
} from '@/domain/physical';
import { Image } from '@/components/ui/image';

interface IconPickerProps {
  value?: IPhysicalIcon;
  onChange: (icon: IPhysicalIcon | undefined) => void;
  bgColor?: string;
  iconColor?: string;
}

export default function IconPicker({ value, onChange, bgColor = '#E5E5EA', iconColor = '#8E8E93' }: IconPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 限制大小 2MB
    if (file.size > 2 * 1024 * 1024) {
      // 静默失败，用户可通过未选中状态感知
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onChange({ type: 'image', imageData: result });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    onChange(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

      {/* 上传图片 */}
      <div className="pt-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        {value?.type === 'image' && value.imageData ? (
          <div className="flex items-center gap-3">
            <div
              className="size-12 rounded-xl overflow-hidden border border-border/60 flex items-center justify-center"
              style={{ backgroundColor: bgColor }}
            >
              <Image
                src={value.imageData}
                alt="自定义图标"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground font-medium truncate">
                自定义图标
              </p>
              <p className="text-xs text-muted-foreground">已上传图片</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
              onClick={handleRemoveImage}
              aria-label="移除图标"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 justify-start text-left font-normal"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="size-4 mr-2 text-muted-foreground" />
            <span className="text-foreground">上传图片作为图标</span>
            <Upload className="ml-auto size-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
}
