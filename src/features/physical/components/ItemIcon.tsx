import { Package } from 'lucide-react';
import {
  PRESET_ICONS,
  DefaultIcon,
  inferIconFromName,
  type IPhysicalIcon,
} from '@/domain/physical';
import { Image } from '@/components/ui/image';

interface ItemIconProps {
  icon?: IPhysicalIcon;
  /** 物品名称：图标缺失时用于按名称推断兜底（导入的旧数据 / 精简 JSON） */
  name?: string;
  size?: number;
  bgColor?: string;
  iconColor?: string;
}

/** 渲染实物图标：预设 lucide 图标或上传图片，带圆形背景 */
export default function ItemIcon({
  icon,
  name,
  size = 48,
  bgColor = '#E5E5EA',
  iconColor = '#8E8E93',
}: ItemIconProps) {
  // 上传图片
  if (icon?.type === 'image' && icon.imageData) {
    return (
      <div
        className="rounded-full overflow-hidden shrink-0 flex items-center justify-center"
        style={{ width: size, height: size, backgroundColor: bgColor }}
      >
        <Image
          src={icon.imageData}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // 预设图标（优先用已存 icon；缺失时按名称推断兜底）
  let IconComp = DefaultIcon;
  const presetKey = icon?.type === 'preset' ? icon.presetKey : (name ? inferIconFromName(name)?.presetKey : undefined);
  if (presetKey) {
    const found = PRESET_ICONS.find((p) => p.key === presetKey);
    if (found) IconComp = found.icon;
  }

  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, backgroundColor: bgColor }}
    >
      <IconComp
        className="shrink-0"
        style={{ width: size * 0.5, height: size * 0.5, color: iconColor }}
        strokeWidth={1.8}
      />
    </div>
  );
}
