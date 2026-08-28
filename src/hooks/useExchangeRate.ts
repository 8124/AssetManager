/**
 * 汇率 Hook：桥接「本地存储」与「React 状态」。
 *
 * 顶部导航栏（AppHeader）内部使用，供资产 / 实物页面共用。
 */

import { useState, useEffect, useCallback } from 'react';
import { localFileStore } from '@/store/localFileStore';
import { DEFAULT_RATE, STORAGE_KEYS, type IExchangeRate } from '@/domain/asset';

export function useExchangeRate() {
  const [rateInfo, setRateInfo] = useState<IExchangeRate>(() =>
    localFileStore.get<IExchangeRate>(STORAGE_KEYS.RATE) ?? DEFAULT_RATE,
  );

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

  return { rateInfo, fetchRate };
}
