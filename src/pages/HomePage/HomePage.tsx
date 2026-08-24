import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import OverviewSection from './sections/OverviewSection';
import ChartsSection from './sections/ChartsSection';
import AssetFormDialog from './sections/AssetFormDialog';
import RecordsDialog from './sections/RecordsDialog';
import {
  useAssetRecords,
  useExchangeRate,
  deriveCategories,
  type IAssetRecord,
} from '@/data/asset';
import { exportAssetMatrixExcel } from '@/data/export';

export default function HomePage() {
  const { rateInfo, fetchRate } = useExchangeRate();
  const { records, addRecord, updateRecord, deleteRecord } = useAssetRecords(rateInfo.rate);
  // 类别从记录中自动派生（去重），无需单独存储
  const categories = useMemo(() => deriveCategories(records), [records]);

  const [formOpen, setFormOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IAssetRecord | null>(null);

  // 概览数据
  const { totalCNY, categoryCount, latestDate, growthPct } = useMemo(() => {
    const total = records.reduce((sum, r) => sum + r.amountCNY, 0);
    const catCount = new Set(records.map((r) => r.category)).size;
    const latest = records.length
      ? records.reduce((l, r) => (r.date > l ? r.date : l), records[0].date)
      : '';

    // 增长率从记录计算（按日期最早/最晚的资产总值对比）
    let growth = 0;
    const sortedDates = [...new Set(records.map((r) => r.date))].sort();
    if (sortedDates.length >= 2) {
      const firstDate = sortedDates[0];
      const lastDate = sortedDates[sortedDates.length - 1];
      const totalOn = (targetDate: string) =>
        records
          .filter((r) => r.date <= targetDate)
          .reduce((sum, r) => sum + r.amountCNY, 0);
      const firstTotal = totalOn(firstDate);
      const lastTotal = totalOn(lastDate);
      if (firstTotal > 0) {
        growth = ((lastTotal - firstTotal) / firstTotal) * 100;
      }
    }

    return {
      totalCNY: total,
      categoryCount: catCount,
      latestDate: latest,
      growthPct: growth,
    };
  }, [records]);

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
    (data: { name: string; category: string; amount: number; currency: 'CNY' | 'USD'; date: string }) => {
      addRecord(data);
    },
    [addRecord],
  );

  const handleUpdateRecord = useCallback(
    (id: string, data: { name: string; category: string; amount: number; currency: 'CNY' | 'USD'; date: string }) => {
      updateRecord(id, data);
    },
    [updateRecord],
  );

  const handleExport = () => {
    if (records.length === 0) {
      toast.warning('暂无数据可导出');
      return;
    }
    exportAssetMatrixExcel(records);
  };

  return (
    <div className="bg-[#F2F2F7]">
      <AppHeader
        rate={rateInfo.rate}
        updatedAt={rateInfo.updatedAt}
        onFetchRate={fetchRate}
      />

      <main className="py-5 md:py-6">
        <OverviewSection
          totalCNY={totalCNY}
          recordCount={records.length}
          categoryCount={categoryCount}
          latestDate={latestDate}
          growthPct={growthPct}
          onAddClick={handleAddClick}
          onRecordsClick={() => setRecordsOpen(true)}
          onExportClick={handleExport}
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
