import { useState, useMemo, useCallback } from 'react';
import AppHeader from '@/components/layout/AppHeader';
import OverviewSection from './components/OverviewSection';
import ChartsSection from './components/ChartsSection';
import AssetFormDialog from './components/AssetFormDialog';
import RecordsDialog from './components/RecordsDialog';
import {
  computeYearAvgFromRecordLine,
  deriveCategories,
  type IAssetRecord,
} from '@/domain/asset';
import { useAssetRecords, useRecordLine } from './hooks';
import { useExchangeRate } from '@/hooks/useExchangeRate';

export default function AssetsPage() {
  // 汇率：AppHeader 亦会读取，两者经 store 订阅保持同步
  const { rateInfo } = useExchangeRate();
  const { records, addRecord, updateRecord, deleteRecord } = useAssetRecords(rateInfo.rate);

  // 类别从记录中自动派生（去重），无需单独存储
  const categories = useMemo(() => deriveCategories(records), [records]);
  // 按日期聚合的资产快照（用于趋势图 & 今年平均资产）
  const recordLine = useRecordLine();
  // 今年平均资产：取本年度每月月末快照总额的平均值
  const yearAvg = useMemo(
    () => computeYearAvgFromRecordLine(recordLine),
    [recordLine],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IAssetRecord | null>(null);

  // 概览数据
  const { totalCNY, latestDate, prevDate, growthPct, growthAmount } = useMemo(() => {
    const total = records.reduce((sum, r) => sum + r.amountCNY, 0);

    // 按日期排序的资产快照（与柱状图同一数据源）
    const sortedLine = [...recordLine].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sortedLine.length
      ? sortedLine[sortedLine.length - 1].date
      : records.length
        ? records.reduce((l, r) => (r.date > l ? r.date : l), records[0].date)
        : '';

    // 增长率：当前日期（最近一次快照）的总资产 相对 上一个有记录的日期的总资产
    let growth = 0;
    let growthAmount: number | null = null;
    let prevDate: string | null = null;
    if (sortedLine.length >= 2) {
      const last = sortedLine[sortedLine.length - 1];
      const prev = sortedLine[sortedLine.length - 2];
      prevDate = prev.date;
      growthAmount = +(last.tolamount - prev.tolamount).toFixed(2);
      if (prev.tolamount > 0) {
        growth = ((last.tolamount - prev.tolamount) / prev.tolamount) * 100;
      }
    }

    return {
      totalCNY: total,
      latestDate: latest,
      prevDate,
      growthPct: growth,
      growthAmount,
    };
  }, [records, recordLine]);

  const handleAddClick = () => {
    setEditingRecord(null);
    setFormOpen(true);
  };

  const handleEdit = (record: IAssetRecord) => {
    setEditingRecord(record);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingRecord(null);
  };

  const handleAddRecord = useCallback(
    (data: {
      name: string;
      category: string;
      amount: number;
      currency: 'CNY' | 'USD';
      date: string;
    }) => {
      addRecord(data);
    },
    [addRecord],
  );

  const handleUpdateRecord = useCallback(
    (
      id: string,
      data: {
        name: string;
        category: string;
        amount: number;
        currency: 'CNY' | 'USD';
        date: string;
      },
    ) => {
      updateRecord(id, data);
    },
    [updateRecord],
  );

  return (
    <div className="bg-[#F2F2F7]">
      <AppHeader />

      <main className="py-5 md:py-6">
        <OverviewSection
          totalCNY={totalCNY}
          recordCount={records.length}
          latestDate={latestDate}
          prevDate={prevDate}
          growthPct={growthPct}
          growthAmount={growthAmount}
          yearAvg={yearAvg}
          onAddClick={handleAddClick}
          onRecordsClick={() => setRecordsOpen(true)}
        />

        <ChartsSection records={records} />

        <footer className="w-full pt-4 pb-8">
          <div className="max-w-6xl mx-auto px-4 md:px-6 text-center text-xs text-muted-foreground">
            资产管家 · 所有数据存储在您的本地文件中 · 隐私安全
          </div>
        </footer>
      </main>

      <AssetFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        categories={categories}
        onSubmit={handleAddRecord}
        editingRecord={editingRecord}
        onUpdate={handleUpdateRecord}
      />

      <RecordsDialog
        open={recordsOpen}
        onOpenChange={setRecordsOpen}
        records={records}
        categories={categories}
        onEdit={handleEdit}
        onDelete={deleteRecord}
      />
    </div>
  );
}
