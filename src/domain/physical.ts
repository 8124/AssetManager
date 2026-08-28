/**
 * 实物资产领域模型：纯类型与纯函数。
 *
 * 本模块不依赖 React、不依赖存储层，只包含：
 * - 实物条目 / 图标的类型定义
 * - 纯计算函数（持有天数、日均成本、日期安全解析、图标推断等）
 */

import type { LucideIcon } from 'lucide-react';
import {
  Monitor,
  Headphones,
  Smartphone,
  Watch,
  Package,
  Laptop,
  Tablet,
  Speaker,
} from 'lucide-react';

export interface IPhysicalIcon {
  /** 图标类型：预设图标 / 上传图片 */
  type: 'preset' | 'image';
  /** 预设图标 key（type=preset 时） */
  presetKey?: string;
  /** 上传图片 base64/dataURL（type=image 时） */
  imageData?: string;
}

export interface IPhysicalItem {
  id: string;
  /** 实物名称 */
  name: string;
  /** 实物价格（人民币元） */
  price: number;
  /** 购买日期，格式 YYYY-MM-DD */
  purchaseDate: string;
  /** 物品图标（可选，不选用默认） */
  icon?: IPhysicalIcon;
  /** 创建时间戳 */
  createdAt: number;
}

export const PRESET_ICONS: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: 'monitor', label: '电脑', icon: Monitor },
  { key: 'laptop', label: '笔记本', icon: Laptop },
  { key: 'smartphone', label: '手机', icon: Smartphone },
  { key: 'tablet', label: '平板', icon: Tablet },
  { key: 'headphones', label: '耳机', icon: Headphones },
  { key: 'speaker', label: '音箱', icon: Speaker },
  { key: 'watch', label: '手表', icon: Watch },
];

export const DEFAULT_ICON_KEY = 'package';
export const DefaultIcon = Package;

/**
 * 根据实物名称推断一个合适的预设图标。
 * 用于导入的精简 JSON（无 icon 字段）或旧数据缺失图标时兜底，
 * 保证重新导入账本后实物仍能显示对应的图标。
 */
export function inferIconFromName(name: string): IPhysicalIcon | undefined {
  const n = (name || '').toLowerCase();
  // 笔记本 / Mac
  if (/(笔记本|笔电|macbook|mac|laptop)/.test(n)) {
    return { type: 'preset', presetKey: 'laptop' };
  }
  // 台式 / 电脑 / 主机
  if (/(台式|电脑|主机|一体机|desktop)/.test(n)) {
    return { type: 'preset', presetKey: 'monitor' };
  }
  // 手机
  if (/(手机|iphone|phone)/.test(n)) {
    return { type: 'preset', presetKey: 'smartphone' };
  }
  // 平板
  if (/(平板|ipad|tablet|\bpad\b)/.test(n)) {
    return { type: 'preset', presetKey: 'tablet' };
  }
  // 耳机 / 耳麦 / 音箱
  if (/(耳机|耳麦|耳塞|airpods|headphone|earphone|音箱|音响|speaker)/.test(n)) {
    return { type: 'preset', presetKey: 'headphones' };
  }
  // 手表 / 手环
  if (/(手表|手环|watch|band|\bfit\b)/.test(n)) {
    return { type: 'preset', presetKey: 'watch' };
  }
  return undefined;
}

/**
 * 安全解析日期字符串，支持 YYYY-MM-DD 和 YYYY-M-D（未补零）格式。
 * 避免 Safari 等浏览器对非标准日期格式解析失败返回 Invalid Date。
 */
export function parseDateSafe(dateStr: string): Date {
  if (!dateStr) return new Date();
  const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** 今天 0 点的 Date（用于持有天数 / 日均成本计算） */
function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** 持有天数 = 今天 - 购买日期（至少 1 天，当天购入算 1 天） */
export function calcHeldDays(purchaseDate: string): number {
  const purchase = parseDateSafe(purchaseDate);
  purchase.setHours(0, 0, 0, 0);
  const diffTime = startOfToday().getTime() - purchase.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

/** 持有成本/天 = 价格 / 持有天数 */
export function calcCostPerDay(price: number, purchaseDate: string): number {
  const days = calcHeldDays(purchaseDate);
  return +(price / days).toFixed(2);
}
