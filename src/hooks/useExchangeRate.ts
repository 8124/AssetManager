/**
 * 汇率 Hook：桥接「本地存储」与「React 状态」。
 *
 * 顶部导航栏（AppHeader）内部使用，供资产 / 实物页面共用。
 * 汇率每天自动更新一次（首次打开应用时检测跨天即自动拉取），
 * 不提供手动刷新入口。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { localFileStore } from '@/store/localFileStore';
import { DEFAULT_RATE, STORAGE_KEYS, type IExchangeRate } from '@/domain/asset';

/** 判断两个时间戳是否属于同一天（本地时区） */
function isSameDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function useExchangeRate() {
  const [rateInfo, setRateInfo] = useState<IExchangeRate>(() =>
    localFileStore.get<IExchangeRate>(STORAGE_KEYS.RATE) ?? DEFAULT_RATE,
  );
  // 防止同一页面内多个组件实例重复触发自动更新
  const autoFetchedRef = useRef(false);

  useEffect(() => {
    localFileStore.set(STORAGE_KEYS.RATE, rateInfo);
  }, [rateInfo]);

  // 订阅外部数据变更（导入 JSON、切换账本等），同步刷新 React 状态
  useEffect(() => {
    return localFileStore.subscribe(() => {
      const latest = localFileStore.get<IExchangeRate>(STORAGE_KEYS.RATE) ?? DEFAULT_RATE;
      setRateInfo((prev) => (prev === latest ? prev : latest));
    });
  }, []);

  // 内部自动拉取：不对外暴露
  const fetchRate = useCallback(async () => {
    // 公开免费汇率 API（无需 key）
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (!res.ok) throw new Error('Network error');
    const data = (await res.json()) as { rates: { CNY: number } };
    const cnyRate = data?.rates?.CNY;
    if (typeof cnyRate !== 'number' || cnyRate <= 0) throw new Error('Invalid rate');
    setRateInfo({ rate: +cnyRate.toFixed(4), updatedAt: Date.now(), source: 'auto' });
    return cnyRate;
  }, []);

  // 每日自动更新：挂载时若上次更新不是今天，则自动拉取最新汇率
  useEffect(() => {
    if (autoFetchedRef.current) return;
    autoFetchedRef.current = true;

    if (!isSameDay(rateInfo.updatedAt, Date.now())) {
      fetchRate().catch(() => {
        // 自动更新失败时静默保留上次汇率，不打扰用户
      });
    }
    // 仅在挂载时执行一次检测
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { rateInfo };
}
