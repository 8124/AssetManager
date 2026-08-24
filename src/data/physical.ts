// EXPORTS: IPhysicalItem, IPhysicalIcon, PRESET_ICONS, DEFAULT_ICON_KEY, usePhysicalItems, calcCostPerDay, calcHeldDays

import { useState, useEffect, useCallback } from 'react';
import { localFileStore } from './localFileStore';
import type { LucideIcon } from 'lucide-react';
import { Monitor, Headphones, Smartphone, Watch, Package } from 'lucide-react';

export interface IPhysicalIcon {
  /** 图标类型：预设图标 / 上传图片 */
  type: 'preset' | 'image';
  /** 预设图标 key（type=preset 时） */
  presetKey?: string;
  /** 上传图片 base64/dataURL（type=image 时） */
  imageData?: string;
}

export const PRESET_ICONS: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: 'monitor', label: '电脑', icon: Monitor },
  { key: 'headphones', label: '耳机', icon: Headphones },
  { key: 'smartphone', label: '手机', icon: Smartphone },
  { key: 'watch', label: '手表', icon: Watch },
];

export const DEFAULT_ICON_KEY = 'package';
export const DefaultIcon = Package;

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

const STORAGE_KEY = 'physical_items';

const genId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * 安全解析日期字符串，支持 YYYY-MM-DD 和 YYYY-M-D（未补零）格式
 * 避免 Safari 等浏览器对非标准日期格式解析失败返回 Invalid Date
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

function loadItems(): IPhysicalItem[] {
  // FileStoreGate 已确保文件就绪，同步读取内存数据
  return localFileStore.get<IPhysicalItem[]>('physical_items') ?? [];
}

function saveItems(items: IPhysicalItem[]) {
  // 写入内存并自动防抖写盘
  localFileStore.set('physical_items', items);
}

/**
 * 计算持有成本/天
 * 持有天数 = 今天 - 购买日期（至少1天）
 * 成本/天 = 价格 / 持有天数
 */
export function calcCostPerDay(price: number, purchaseDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const purchase = parseDateSafe(purchaseDate);
  purchase.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - purchase.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const days = Math.max(1, diffDays + 1); // 至少1天，当天购入算1天

  return +(price / days).toFixed(2);
}

/** 计算持有天数 */
export function calcHeldDays(purchaseDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const purchase = parseDateSafe(purchaseDate);
  purchase.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - purchase.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

export function usePhysicalItems() {
  const [items, setItems] = useState<IPhysicalItem[]>(() => loadItems());

  useEffect(() => {
    saveItems(items);
  }, [items]);

  // 订阅外部数据变更（导入 JSON、切换账本等），同步刷新 React 状态
  useEffect(() => {
    return localFileStore.subscribe(() => {
      const latest = loadItems();
      setItems((prev) => (prev === latest ? prev : latest));
    });
  }, []);

  const addItem = useCallback((data: Omit<IPhysicalItem, 'id' | 'createdAt'>) => {
    const newItem: IPhysicalItem = {
      ...data,
      id: genId(),
      createdAt: Date.now(),
    };
    setItems((prev) => [...prev, newItem]);
    return newItem;
  }, []);

  const updateItem = useCallback((id: string, data: Partial<Omit<IPhysicalItem, 'id' | 'createdAt'>>) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...data } : i)),
    );
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return { items, addItem, updateItem, deleteItem };
}
