import * as XLSX from 'xlsx';
import { IAssetRecord } from './asset';

/**
 * 导出资产矩阵为 Excel：
 * - 行：资产名称
 * - 列：各记录时间点（升序）
 * - 单元格：该资产在对应时间点折算后的人民币价值
 */
export function exportAssetMatrixExcel(records: IAssetRecord[]) {
  if (records.length === 0) {
    return;
  }

  // 所有资产名称（按类别+名称排序）
  const assetNames = Array.from(new Set(records.map((r) => r.name))).sort((a, b) => {
    const aCat = records.find((r) => r.name === a)?.category ?? '';
    const bCat = records.find((r) => r.name === b)?.category ?? '';
    if (aCat !== bCat) return aCat.localeCompare(bCat);
    return a.localeCompare(b);
  });

  // 所有日期（升序）
  const dates = Array.from(new Set(records.map((r) => r.date))).sort();

  // 计算每个资产在每个时间点的累计值
  // 因为是存量资产，需要累加到该日期为止的所有记录
  const matrix: Record<string, Record<string, number>> = {};
  assetNames.forEach((name) => {
    matrix[name] = {};
    let cumulative = 0;
    const assetRecords = records
      .filter((r) => r.name === name)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

    let ptr = 0;
    dates.forEach((date) => {
      while (ptr < assetRecords.length && assetRecords[ptr].date <= date) {
        cumulative += assetRecords[ptr].amountCNY;
        ptr++;
      }
      matrix[name][date] = +cumulative.toFixed(2);
    });
  });

  // 构造工作表数据
  const headerRow = ['资产名称', '类别', ...dates];
  const dataRows = assetNames.map((name) => {
    const category = records.find((r) => r.name === name)?.category ?? '';
    const row: (string | number)[] = [name, category];
    dates.forEach((date) => {
      row.push(matrix[name][date] ?? 0);
    });
    return row;
  });

  const wsData = [headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 列宽
  const colWidths = [
    { wch: 24 }, // 资产名称
    { wch: 12 }, // 类别
    ...dates.map(() => ({ wch: 14 })),
  ];
  ws['!cols'] = colWidths;

  // 冻结首行 + 首两列
  ws['!freeze'] = { xSplit: 2, ySplit: 1 };

  // 金额列格式
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = 2; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[addr]) {
        ws[addr].z = '#,##0.00';
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '资产矩阵');

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `资产矩阵_${today}.xlsx`);
}
