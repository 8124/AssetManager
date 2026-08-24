import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption, PieSeriesOption, BarSeriesOption } from 'echarts';
import type { CallbackDataParams } from 'echarts/types/dist/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IAssetRecord, IRecordLineEntry, useRecordLine, formatCurrencyCNY, formatAssetLabel } from '@/data/asset';

const CATEGORY_COLORS = [
  '#bfdfd2',
  '#51999f',
  '#4198ac',
  '#7bc0cd',

  '#ecb66c',
  '#ea9e58',
  '#ed8d5a',
  '#f1837a',
  '#b6b3d6',
];

/**
 * 建立稳定的「类别名称 → 颜色」映射
 * 规则：所有类别按字母排序后，依次从 CATEGORY_COLORS 循环取色
 */
function buildCategoryColorMap(allCategoryNames: string[]): Record<string, string> {
  const sorted = [...allCategoryNames].sort();
  const map: Record<string, string> = {};
  sorted.forEach((name, i) => {
    map[name] = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
  });
  return map;
}

type BarView = 'week' | 'year' | 'all';

interface ProcessedBarData {
  dates: string[];
  categories: string[];
  seriesData: Record<string, number[]>;
  totals: number[];
  simplified: boolean;
}

/**
 * 根据视图处理 recordline 数据：
 * - week：最近 7 个有数据的日期点
 * - year：最近 12 个月，每月取月末快照
 * - all：全部日期点，超过 20 条时标记为简化模式
 */
function processRecordLineData(
  recordLine: IRecordLineEntry[],
  view: BarView,
): ProcessedBarData {
  if (recordLine.length === 0) {
    return { dates: [], categories: [], seriesData: {}, totals: [], simplified: false };
  }

  const sorted = [...recordLine].sort((a, b) => a.date.localeCompare(b.date));
  let filtered: IRecordLineEntry[] = [];

  if (view === 'week') {
    filtered = sorted.slice(-7);
  } else if (view === 'year') {
    const monthMap = new Map<string, IRecordLineEntry>();
    for (const entry of sorted) {
      const month = entry.date.slice(0, 7);
      monthMap.set(month, entry);
    }
    filtered = Array.from(monthMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12);
  } else {
    filtered = sorted;
  }

  const allCategories = new Set<string>();
  for (const entry of filtered) {
    for (const cat of Object.keys(entry.categories)) {
      allCategories.add(cat);
    }
  }
  const categories = Array.from(allCategories).sort();

  const simplified = view === 'all' && filtered.length > 20;
  const dates = filtered.map((e) => e.date);
  const totals = filtered.map((e) => e.tolamount);

  const seriesData: Record<string, number[]> = {};
  for (const cat of categories) {
    seriesData[cat] = filtered.map((e) => e.categories[cat] ?? 0);
  }

  return { dates, categories, seriesData, totals, simplified };
}

interface ChartsSectionProps {
  records: IAssetRecord[];
}

/** 调节颜色饱和度，保持色相(H)和明度(L)不变。satFactor > 1 更鲜艳，< 1 更灰 */
function adjustSaturation(hex: string, satFactor: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16) / 255;
  const g = parseInt(m.substring(2, 4), 16) / 255;
  const b = parseInt(m.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  s = Math.min(1, Math.max(0, s * satFactor));

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r2 = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g2 = Math.round(hue2rgb(p, q, h) * 255);
  const b2 = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return '#' + ((1 << 24) + (r2 << 16) + (g2 << 8) + b2).toString(16).slice(1);
}

export default function ChartsSection({ records }: ChartsSectionProps) {
  const totalCNY = useMemo(
    () => records.reduce((sum, r) => sum + r.amountCNY, 0),
    [records],
  );

  const recordLine = useRecordLine();
  const [barView, setBarView] = useState<BarView>('all');

  // ============ 堆叠柱状图 ============
  const barOption: EChartsOption = useMemo(() => {
    const { dates, categories, seriesData, totals, simplified } = processRecordLineData(
      recordLine,
      barView,
    );
    if (dates.length === 0) return {};

    const colorMap = buildCategoryColorMap(categories);

    // 上一日期点的值，用于计算增长
    const prevByCat: Record<string, (number | null)[]> = {};
    for (const cat of categories) {
      prevByCat[cat] = seriesData[cat].map((_, i) =>
        i === 0 ? null : seriesData[cat][i - 1],
      );
    }
    const prevTotals = totals.map((_, i) => (i === 0 ? null : totals[i - 1]));

    const baseGrid = {
      left: 56,
      right: 16,
      top: 16,
      bottom: dates.length > 15 ? 64 : 48,
    };

    if (simplified) {
      // 简化模式：只显示总额，固定柱宽，条数多时收窄
      const barWidth =
        dates.length > 60 ? 10 : dates.length > 40 ? 14 : dates.length > 25 ? 20 : 28;
      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: CallbackDataParams[]) => {
            const idx = params[0].dataIndex;
            const total = totals[idx];
            const prev = prevTotals[idx];
            const growth = prev != null ? +(total - prev).toFixed(2) : null;
            const growthRate =
              prev != null && prev !== 0 ? +((growth! / prev) * 100).toFixed(2) : null;
            let html = `<div style="font-weight:600;margin-bottom:4px">${dates[idx]}</div>`;
            html += `总资产：${formatCurrencyCNY(total)}`;
            if (growth != null) {
              const sign = growth >= 0 ? '+' : '';
              html += `<br/>增长：${sign}${formatCurrencyCNY(Math.abs(growth))}`;
              if (growthRate != null) {
                html += `（${sign}${growthRate}%）`;
              }
            }
            return html;
          },
        },
        grid: baseGrid,
        xAxis: {
          type: 'category',
          data: dates,
          axisLabel: { fontSize: 10, rotate: dates.length > 20 ? 45 : 0, hideOverlap: true },
        },
        yAxis: { type: 'value' },
        series: [
          {
            name: '总资产',
            type: 'bar',
            data: totals,
            barWidth,
            barGap: '15%',
            itemStyle: { color: '#007AFF', borderRadius: [6, 6, 6, 6] },
          } as BarSeriesOption,
        ],
      };
    }

    // 堆叠模式
    const series: BarSeriesOption[] = categories.map((cat) => ({
      name: cat,
      type: 'bar',
      stack: 'total',
      data: seriesData[cat],
      barWidth: 36,
      barGap: '10%',
      itemStyle: {
        color: colorMap[cat],
        borderRadius: [6, 6, 6, 6],
        borderColor: '#ffffff',
        borderWidth: 1,
      },
      emphasis: { focus: 'series' },
    }));

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: CallbackDataParams[]) => {
          const idx = params[0].dataIndex;
          const total = totals[idx];
          let html = `<div style="font-weight:600;margin-bottom:4px">${dates[idx]}</div>`;
          html += `<div style="color:#8e8e93;font-size:11px;margin-bottom:6px">总资产：${formatCurrencyCNY(total)}</div>`;
          const sorted = [...params].sort((a, b) => Number(b.value) - Number(a.value));
          for (const p of sorted) {
            const val = Number(p.value) || 0;
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
            const cat = p.seriesName as string;
            const prev = prevByCat[cat]?.[idx];
            const growth = prev != null ? +(val - prev).toFixed(2) : null;
            const growthRate =
              prev != null && prev !== 0 ? +((growth! / prev) * 100).toFixed(1) : null;
            html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">`;
            html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0"></span>`;
            html += `<span style="font-size:12px">${cat}</span>`;
            html += `<span style="margin-left:auto;font-variant-numeric:tabular-nums;font-size:12px">${formatCurrencyCNY(val)}</span>`;
            html += `</div>`;
            html += `<div style="font-size:11px;color:#8e8e93;padding-left:14px;margin-bottom:2px"> ${pct}%`;
            if (growth != null) {
              const sign = growth >= 0 ? '+' : '';
              html += ` ·  ${sign}${formatCurrencyCNY(Math.abs(growth))}`;
              if (growthRate != null) {
                html += `（${sign}${growthRate}%）`;
              }
            }
            html += `</div>`;
          }
          return html;
        },
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 12,
        textStyle: { fontSize: 11, color: 'hsl(222 18% 14%)' },
      },
      grid: baseGrid,
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { fontSize: 10, rotate: dates.length > 10 ? 30 : 0 },
      },
      yAxis: { type: 'value' },
      series,
    };
  }, [recordLine, barView]);

  // ============ 双层嵌套环形饼图 ============
  const nestedPieOption: EChartsOption = useMemo(() => {
    // 外层：按类别汇总（金额降序）
    const categoryMap = new Map<string, number>();
    const categoryNameMap = new Map<string, { category: string; value: number }>();
    records.forEach((r) => {
      const label = formatAssetLabel(r);
      categoryMap.set(r.category, (categoryMap.get(r.category) ?? 0) + r.amountCNY);
      const prev = categoryNameMap.get(label);
      categoryNameMap.set(label, {
        category: r.category,
        value: (prev?.value ?? 0) + r.amountCNY,
      });
    });

    const categories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value: +value.toFixed(2) }));

    const total = categories.reduce((s, d) => s + d.value, 0);

    // 统一类别颜色映射（按字母序分配颜色）
    const categoryColorMap = buildCategoryColorMap(categories.map((c) => c.name));
    const outerColors = categories.map((c) => categoryColorMap[c.name]);
    const innerData: { name: string; value: number; category: string; itemStyle?: { color: string } }[] = [];

    categories.forEach((cat, catIdx) => {
      const baseColor = outerColors[catIdx];
      const items = Array.from(categoryNameMap.entries())
        .filter(([, v]) => v.category === cat.name)
        .sort((a, b) => b[1].value - a[1].value);
      if (items.length === 0) return;
      const catTotal = items.reduce((s, [, v]) => s + v.value, 0);
      items.forEach(([name, v]) => {
        const ratio = catTotal > 0 ? v.value / catTotal : 0;
        const satFactor = 1 + ratio * 1.2;
        innerData.push({
          name,
          value: +v.value.toFixed(2),
          category: cat.name,
          itemStyle: { color: adjustSaturation(baseColor, satFactor) },
        });
      });
    });


    const outerSeries: PieSeriesOption = {
      name: '资产类别',
      type: 'pie',
      radius: ['58%', '82%'], // 更厚的外环
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      label: {
        show: true,
        position: 'outside',
        formatter: (params: CallbackDataParams) => {
          const val = Number(params.value) || 0;
          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
          return `${params.name}\n${pct}%`;
        },
        fontSize: 11,
        lineHeight: 16,
        alignTo: 'labelLine',
        edgeDistance: '8%',
      },
      labelLine: {
        show: true,
        length: 8,
        length2: 8,
        smooth: true,
      },
      emphasis: {
        label: { show: true, fontSize: 12, fontWeight: 'bold' },
        scale: true,
        scaleSize: 4,
      },
      data: categories,
      color: outerColors,
      clockwise: false,
      itemStyle: {
        borderRadius: 4,
        borderColor: '#fff',
        borderWidth: 1,
      },
    };

    const innerSeries: PieSeriesOption = {
      name: '资产明细',
      type: 'pie',
      radius: ['42%', '54%'], // 更厚的内环，与外层间距缩小
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      label: {
        show: false, // 内层标签默认隐藏，hover 时通过 tooltip 显示
      },
      labelLine: { show: false },
      emphasis: {
        label: { show: false },
        scale: true,
        scaleSize: 3,
      },
      data: innerData,
      clockwise: false,
      itemStyle: {
        borderRadius: 3,
        borderColor: '#fff',
        borderWidth: 2,
      },
    };

    return {
      color: outerColors,
      tooltip: {
        trigger: 'item',
        formatter: (params: CallbackDataParams) => {
          const val = Number(params.value) || 0;
          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
          const isOuter = params.seriesName === '资产类别';
          const seriesLabel = isOuter ? '类别' : '明细';
          return `<span style="font-size:11px;color:#8e8e93">${seriesLabel}</span><br/>${params.name}<br/>金额：${formatCurrencyCNY(val)}<br/>占比：${pct}%`;
        },
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 4,
        top: 'center',
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 10,
        textStyle: { fontSize: 12, color: 'hsl(222 18% 14%)' },
        show: false,
      },
      series: [outerSeries, innerSeries],
    };
  }, [records]);

  return (
    <section className="w-full">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 gap-4">
          {/* 双层嵌套饼图 */}
          <Card className="border-border/40 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">资产类别分布</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {records.length === 0 ? (
                <div className="h-[360px] flex items-center justify-center text-sm text-muted-foreground">
                  暂无数据，请先添加资产记录
                </div>
              ) : (
                <div className="relative">
                  <ReactECharts
                    option={nestedPieOption}
                    theme="ud"
                    className="h-[360px] w-full"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[11px] text-muted-foreground">总资产</span>
                    <span className="text-lg font-bold text-foreground mt-1 tabular-nums">
                      {totalCNY >= 10000
                        ? `${(totalCNY / 10000).toFixed(2)}万`
                        : totalCNY.toFixed(0)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 堆叠柱状图 */}
          <Card className="border-border/40 bg-white shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">资产趋势</CardTitle>
              <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
                {(['week', 'year', 'all'] as BarView[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setBarView(v)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      barView === v
                        ? 'bg-white text-foreground shadow-sm font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {v === 'week' ? '周' : v === 'year' ? '月' : '全部'}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {recordLine.length === 0 ? (
                <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
                  暂无数据，请先添加资产记录
                </div>
              ) : (
                <ReactECharts
                  option={barOption}
                  theme="ud"
                  className="h-[320px] w-full"
                  notMerge
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
