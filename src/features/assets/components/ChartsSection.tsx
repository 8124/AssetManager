import { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption, PieSeriesOption, BarSeriesOption } from 'echarts';
import type { CallbackDataParams } from 'echarts/types/dist/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatAssetLabel, formatCurrencyCNY, type IAssetRecord } from '@/domain/asset';
import type { IRecordLineEntry } from '@/domain/asset';
import { adjustSaturation, buildCategoryColorMap } from '@/lib/charts';
import { useRecordLine } from '../hooks';

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
  // 计算各类别在所有日期中的汇总金额，用于排序
  const categorySum: Record<string, number> = {};
  for (const cat of allCategories) categorySum[cat] = 0;
  for (const entry of filtered) {
    for (const [cat, val] of Object.entries(entry.categories)) {
      categorySum[cat] += val ?? 0;
    }
  }
  // 按汇总金额降序：大的在前（堆叠在底部），小的在后（堆叠在顶部）
  const categories = Array.from(allCategories).sort((a, b) => categorySum[b] - categorySum[a]);

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

export default function ChartsSection({ records }: ChartsSectionProps) {
  const totalCNY = useMemo(
    () => records.reduce((sum, r) => sum + r.amountCNY, 0),
    [records],
  );

  const recordLine = useRecordLine();
  const [barView, setBarView] = useState<BarView>('all');
  // 当前 hover 的具体色块（seriesName + dataIndex），为 null 表示在柱子空白处
  const hoveredBarItemRef = useRef<{ seriesName: string; dataIndex: number } | null>(null);
  // 离开色块后的延迟清空定时器：用于避免在相邻色块间隙处闪烁回"概览"
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

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
              const sign = growth > 0 ? '+' : '';
              const color = growth > 0 ? '#FF3B30' : growth < 0 ? '#34C759' : '#8e8e93';
              html += `<br/><span style="color:${color};font-weight:600">增长：${sign}${formatCurrencyCNY(Math.abs(growth))}`;
              if (growthRate != null) {
                html += `（${sign}${growthRate}%）`;
              }
              html += `</span>`;
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
            itemStyle: { color: '#007AFF', borderRadius: 4 },
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
        borderRadius: 4,
        borderColor: '#ffffff',
        borderWidth: 0.5,
      },
      emphasis: { focus: 'self' },
    }));

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: CallbackDataParams[]) => {
          const idx = params[0].dataIndex;
          const total = totals[idx];
          const hovered = hoveredBarItemRef.current;

          // 按柱状图堆叠顺序（categories 顺序，大→小）排列，与视觉一致
          const ordered = [...params].sort((a, b) => {
            const ia = categories.indexOf(a.seriesName as string);
            const ib = categories.indexOf(b.seriesName as string);
            return ia - ib;
          });

          // 详细模式：鼠标 hover 在具体色块上，只显示该部分的金额、占比、增长
          if (hovered && hovered.dataIndex === idx) {
            const p = ordered.find((x) => x.seriesName === hovered.seriesName);
            if (p) {
              const val = Number(p.value) || 0;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
              const cat = p.seriesName as string;
              const prev = prevByCat[cat]?.[idx];
              const growth = prev != null ? +(val - prev).toFixed(2) : null;
              const growthRate =
                prev != null && prev !== 0 ? +((growth! / prev) * 100).toFixed(1) : null;

              let html = `<div style="font-weight:600;margin-bottom:6px">${dates[idx]}</div>`;
              html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">`;
              html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0"></span>`;
              html += `<span style="font-size:12px">${cat}</span>`;
              html += `<span style="margin-left:auto;font-variant-numeric:tabular-nums;font-size:13px;font-weight:600">${formatCurrencyCNY(val)}</span>`;
              html += `</div>`;
              html += `<div style="font-size:11px;color:#8e8e93;padding-left:14px">${pct}%`;
              if (growth != null) {
                const sign = growth > 0 ? '+' : '';
                const color = growth > 0 ? '#FF3B30' : growth < 0 ? '#34C759' : '#8e8e93';
                html += `&nbsp;<span style="color:${color};font-weight:600">${sign}${formatCurrencyCNY(Math.abs(growth))}`;
                if (growthRate != null) {
                  html += `（${sign}${growthRate}%）`;
                }
                html += `</span>`;
              }
              html += `</div>`;
              return html;
            }
          }

          // 简化模式：不在具体色块上，仅显示日期、总金额、与上一根柱对比、各部分占比
          let html = `<div style="font-weight:600;margin-bottom:4px">${dates[idx]}</div>`;
          html += `<div style="font-size:12px;margin-bottom:4px">总资产：<span style="font-variant-numeric:tabular-nums;font-weight:600">${formatCurrencyCNY(total)}</span></div>`;
          const prevTotal = prevTotals[idx];
          if (prevTotal != null) {
            const diff = +(total - prevTotal).toFixed(2);
            const sign = diff > 0 ? '+' : '';
            const rate = prevTotal !== 0 ? ((diff / prevTotal) * 100).toFixed(1) : null;
            const color = diff > 0 ? '#FF3B30' : diff < 0 ? '#34C759' : '#8e8e93';
            html += `<div style="font-size:11px;color:${color};font-weight:600;margin-bottom:6px"> ${sign}${formatCurrencyCNY(Math.abs(diff))}${rate != null ? `（${sign}${rate}%）` : ''}</div>`;
          } else {
            html += `<div style="font-size:11px;color:#8e8e93;margin-bottom:6px">首次记录，暂无对比</div>`;
          }
          // 仅展示占比最大的前 3 个类别
          const top3 = [...ordered]
            .map((p) => {
              const val = Number(p.value) || 0;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
              return { p, val, pct };
            })
            .sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct))
            .slice(0, 3);
          for (const { p, val, pct } of top3) {
            html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">`;
            html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0"></span>`;
            html += `<span style="font-size:12px">${p.seriesName}</span>`;
            html += `<span style="margin-left:auto;font-variant-numeric:tabular-nums;font-size:12px">${pct}%</span>`;
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
    const innerData: {
      name: string;
      value: number;
      category: string;
      itemStyle?: { color: string };
    }[] = [];

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
              <CardTitle className="text-sm font-semibold">资产类别</CardTitle>
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
                  className="h-[320px] w-full"
                  notMerge
                  onEvents={{
                    mouseover: (
                      params: {
                        componentType?: string;
                        seriesType?: string;
                        seriesName?: string;
                        dataIndex?: number;
                        seriesIndex?: number;
                      },
                      instance: { dispatchAction: (opts: unknown) => void },
                    ) => {
                      // 进入新色块：取消待执行的"清空"定时器，防止间隙处闪烁
                      if (hoverTimerRef.current) {
                        clearTimeout(hoverTimerRef.current);
                        hoverTimerRef.current = null;
                      }
                      if (
                        params.componentType === 'series' &&
                        params.seriesType === 'bar'
                      ) {
                        hoveredBarItemRef.current = {
                          seriesName: params.seriesName!,
                          dataIndex: params.dataIndex!,
                        };
                        instance?.dispatchAction({
                          type: 'showTip',
                          seriesIndex: params.seriesIndex,
                          dataIndex: params.dataIndex,
                        });
                      }
                    },
                    mouseout: (
                      params: { componentType?: string; dataIndex?: number },
                      instance: { dispatchAction: (opts: unknown) => void },
                    ) => {
                      if (params.componentType === 'series') {
                        // 延迟清空：若短时间内进入相邻色块，mouseover 会取消该定时器，
                        // 只有鼠标真正离开柱子区域后才切回"概览"
                        if (hoverTimerRef.current) {
                          clearTimeout(hoverTimerRef.current);
                        }
                        const dataIndex = params.dataIndex;
                        hoverTimerRef.current = setTimeout(() => {
                          hoverTimerRef.current = null;
                          hoveredBarItemRef.current = null;
                          if (dataIndex != null) {
                            instance?.dispatchAction({
                              type: 'showTip',
                              seriesIndex: 0,
                              dataIndex,
                            });
                          }
                        }, 120);
                      }
                    },
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
