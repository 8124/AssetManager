/**
 * 图表配色工具：类别颜色映射与饱和度调节。
 *
 * 资产类别饼图 / 堆叠柱状图共用的颜色分配逻辑。
 */

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
 * 建立稳定的「类别名称 → 颜色」映射。
 * 规则：所有类别按字母排序后，依次从 CATEGORY_COLORS 循环取色。
 */
export function buildCategoryColorMap(allCategoryNames: string[]): Record<string, string> {
  const sorted = [...allCategoryNames].sort();
  const map: Record<string, string> = {};
  sorted.forEach((name, i) => {
    map[name] = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
  });
  return map;
}

/** 调节颜色饱和度，保持色相(H)和明度(L)不变。satFactor > 1 更鲜艳，< 1 更灰 */
export function adjustSaturation(hex: string, satFactor: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16) / 255;
  const g = parseInt(m.substring(2, 4), 16) / 255;
  const b = parseInt(m.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
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
