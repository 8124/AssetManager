/**
 * 实物数据 Hook：桥接「本地存储」与「React 状态」。
 */

import { useState, useEffect, useCallback } from 'react';
import { genId } from '@/lib/id';
import { localFileStore } from '@/store/localFileStore';
import type { IPhysicalItem } from '@/domain/physical';

const STORAGE_KEY = 'physical_items';

function loadItems(): IPhysicalItem[] {
  // FileStoreGate 已确保文件就绪，同步读取内存数据
  return localFileStore.get<IPhysicalItem[]>(STORAGE_KEY) ?? [];
}

function saveItems(items: IPhysicalItem[]) {
  // 写入内存并自动防抖写盘
  localFileStore.set(STORAGE_KEY, items);
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

  const updateItem = useCallback(
    (id: string, data: Partial<Omit<IPhysicalItem, 'id' | 'createdAt'>>) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)));
    },
    [],
  );

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return { items, addItem, updateItem, deleteItem };
}
