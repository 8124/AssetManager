# 资产可视化软件 - 需求拆解文档

## 产品概述

- **产品类型**: 个人资产管理工具（Web 应用）
- **场景类型**: <scene_type>prototype-app</scene_type>
- **目标用户**: 有资产管理需求的个人用户，偏好简洁直观的界面
- **核心价值**: 通过本地存储的轻量方式，快速录入资产数据并以图表形式可视化展示资产结构与增长趋势
- **界面语言**: 中文
- **主题偏好**: 浅色（iOS/macOS 风格，简洁干净）
- **导航模式**: 无导航（单页应用）
- **导航布局**: 无

---

## 页面结构总览

**页面文件**: `AssetDashboardPage.tsx`

> **说明**：单页应用，所有功能集中在一个页面，通过区块划分实现不同功能模块。围绕同一份资产数据，同时完成录入、查看、图表分析，符合"默认合并、默认单页"原则。

| 区域 | 说明 |
|-----|------|
| 顶部标题栏 | 应用名称 + 汇率显示与设置入口 |
| 资产概览卡片 | 总资产（人民币计价）、资产条目数等核心指标 |
| 图表展示区 | 左侧饼图（类别占比）+ 右侧折线图（时间趋势），桌面端左右并排，移动端上下堆叠 |
| 资产录入表单 | 新增/编辑资产记录的表单区域 |
| 历史记录列表 | 资产记录表格，支持查看、编辑、删除操作 |

---

## 页面布局建议

- **布局模式**: 上下分区 + 图表区左右分栏 —— 顶部为概览指标，中部双栏展示饼图与折线图，底部为录入表单和历史记录列表
- **视觉重心**: 图表 + 概览指标 —— 用户打开后首先看到资产全貌和趋势，录入和管理为辅助操作
- **结果承载区**: 图表区（饼图 + 折线图）实时响应数据变更；初始态为"暂无数据"空状态提示，引导用户添加第一条资产记录

---

## 数据来源声明

| 数据/操作 | 来源类型 | 实现要求 | mock 兜底 |
|---|---|---|---|
| 资产记录数据 | local-persist | localStorage key=`__app_asset_records`，JSON 序列化存储，启动时读取并解析 | 初始 0 条，空状态引导用户添加；可选提供 2-3 条 `source: 'mock'` 示例数据供首次体验 |
| 汇率设置 | local-persist | localStorage key=`__app_asset_exchange_rate`，存储当前 USD→CNY 汇率数值和更新时间 | 初始默认值 7.20（参考值），用户可手动修改或调用 API 更新 |
| 资产类别配置 | local-persist | localStorage key=`__app_asset_categories`，存储用户自定义的资产类别列表 | 初始默认类别：现金、股票、基金、房产 |
| 实时汇率获取 | real-api | 调用公开汇率 API（如 ExchangeRate-API 或类似免费接口）获取 USD/CNY 实时汇率，获取后更新至 localStorage | API 失败时 toast 提示"汇率获取失败，请检查网络或手动设置"，保留上次汇率 |
| 金额表达式计算 | 前端计算 | 输入框失焦时解析 `+` `-` 表达式，使用安全的字符串解析（禁止 eval），计算结果回填并用于提交 | 表达式非法时 toast 提示"请输入正确的金额或运算式"，恢复上次有效值 |

> 类型选择 + 兜底约束见上方"数据来源声明方法论"段。

---

## 功能列表

- **页面**: 资产仪表盘（单页）
  - **页面目标**: 提供资产录入、可视化展示与历史记录管理的一体化工作台
  - **功能点**:
    - **资产概览展示**: 顶部卡片展示总资产（人民币统一计价）、资产条目数、最近更新时间等核心指标，数据随记录增删实时更新
    - **资产类别占比饼图**: 环形/饼图展示各资产类别的金额占比，hover 显示类别名称和金额，支持点击图例切换显示
    - **资产趋势折线图**: 按日期聚合总资产变化，折线图展示随时间的增长趋势，x 轴为日期、y 轴为总资产金额（人民币）
    - **资产记录录入（新增/编辑）**:
      - 触发: 点击"新增资产"按钮或历史记录行的"编辑"按钮
      - 交互: 表单含类别（下拉选择 + 支持新增自定义类别）、金额（支持 `+` `-` 运算表达式自动计算）、币种（人民币/美元单选）、日期（日期选择器，默认今天）
      - 提交: 金额自动按表达式计算结果 + 币种转换为人民币计价后写入记录列表，更新 localStorage
      - 反馈: toast.success("资产记录已保存") + 图表与列表即时刷新
    - **历史记录管理**:
      - 表格展示所有资产记录（类别、原金额+币种、人民币金额、日期）
      - 支持按日期排序、按类别筛选
      - 每行操作：编辑（弹出编辑表单）、删除（弹出确认 Dialog，确认后删除并 toast 反馈）
    - **汇率管理**:
      - 顶部显示当前 USD→CNY 汇率及更新时间
      - 点击"更新汇率"按钮调用公开汇率 API 自动获取最新汇率
      - 支持手动输入设置汇率（Dialog 表单输入 + 确认）
      - 汇率变更后所有美元资产自动重新折算人民币金额，图表同步刷新

---

## 数据共享配置

| 存储键名 | 数据说明 | 使用页面 |
|---------|---------|---------|
| `__app_asset_records` | 资产记录列表，类型为 `IAssetRecord[]` | 资产仪表盘页 |
| `__app_asset_exchange_rate` | 当前美元兑人民币汇率，类型为 `IExchangeRate` | 资产仪表盘页 |
| `__app_asset_categories` | 资产类别列表，类型为 `string[]` | 资产仪表盘页 |

```ts
interface IAssetRecord {
  /** 唯一标识 */
  id: string;
  /** 资产类别 */
  category: string;
  /** 原始金额 */
  amount: number;
  /** 币种 */
  currency: 'CNY' | 'USD';
  /** 折算人民币金额 */
  amountCNY: number;
  /** 日期，格式 YYYY-MM-DD */
  date: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 数据来源（mock 或 user） */
  source?: 'mock' | 'user';
}

interface IExchangeRate {
  /** USD -> CNY 汇率 */
  rate: number;
  /** 更新时间戳 */
  updatedAt: number;
  /** 来源：auto=API自动获取 / manual=手动设置 */
  source: 'auto' | 'manual';
}
```

---

## 设计风格指引

- **整体风格**: 遵循 iOS / macOS 设计语言，大量留白、圆角卡片、柔和阴影、系统字体（SF Pro / PingFang SC）
- **色彩**: 以白色和浅灰为底色，主色调采用蓝色系（类似 macOS 系统蓝），图表配色柔和区分度高
- **交互**: 按钮和卡片有轻微的 hover 动效，表单输入聚焦时有清晰的 focus ring，操作反馈使用轻量 toast 提示

-------

<scene_type>prototype-app</scene_type>

# UI 设计指南

## 1. 设计推导依据

- **参考意图**: Free Direction —— 无参考材料，按产品语义与 iOS/macOS 风格要求自主设计
- **核心情绪 / 应用类型**: 个人财务管理工具，追求清晰、可信、克制的精致感，像原生系统应用一样顺手
- **独特记忆点**: 玻璃态卡片 + 毛玻璃导航栏，配合 SF 字体般的疏朗排版和系统蓝主色，资产数字用等宽增强专业感

## 2. Art Direction

- **方向名**: 苹果系极简玻璃
- **Design Style**: iOS/macOS Human Interface + Soft Glass 轻玻璃 —— 符合用户要求的苹果生态视觉，数据展示清晰不抢戏
- **DNA 参数**: 圆角 soft (rounded-xl / rounded-2xl) / 阴影 subtle (shadow-sm，卡片用极淡投影) / 间距 standard (gap-4 / p-6) / 字体方向：无衬线正文 + 等宽数字 / 装饰手法：毛玻璃导航、极细分隔线、轻量背景模糊
- **应用类型**: Tool / Dashboard —— 顶部概览 + 中部图表 + 底部记录列表

## 3. Color System

**色彩关系**: 系统蓝主色 + 极浅蓝灰辅助底 + 纯白卡片 + 深灰文字，整体偏冷调，符合 macOS 浅色模式气质
**配色设计理由**: 主色用苹果系统蓝承担 CTA 与选中态，背景用极浅灰营造桌面感，卡片纯白上浮形成层级；accent 用极浅蓝灰承接 hover/focus，避免大面积用蓝造成视觉疲劳
**主色推导**: 从 macOS/iOS 系统蓝出发，调至饱和度适中、明度偏高的蓝，既符合用户要求的苹果风格，又保持金融类产品的信任感
**使用比例**: 65% 中性（bg + card + border）/ 28% 辅助（accent + textMuted）/ 7% primary；primary 仅用于主按钮、激活 tab、关键数字高亮，不用于 icon 默认态或边框

| 角色 | CSS 变量 | Tailwind Class | HSL 值 | 设计说明 |
|---|---|---|---|---|
| bg | `--background` | `bg-background` | hsl(210 20% 98%) | 页面背景，接近 macOS 系统灰 |
| card | `--card` | `bg-card` | hsl(0 0% 100%) | 纯白卡片，轻微上浮 |
| text | `--foreground` | `text-foreground` | hsl(222 18% 14%) | 标题和正文，深灰非纯黑 |
| textMuted | `--muted-foreground` | `text-muted-foreground` | hsl(215 12% 48%) | 辅助说明、次要元信息 |
| primary | `--primary` | `bg-primary` / `text-primary` | hsl(212 96% 52%) | 系统蓝，主交互与品牌锚点 |
| primaryForeground | `--primary-foreground` | `text-primary-foreground` | hsl(0 0% 100%) | 主按钮上的白文字 |
| accent | `--accent` | `bg-accent` | hsl(210 20% 96%) | hover/focus 浅底、选中态背景 |
| accentForeground | `--accent-foreground` | `text-accent-foreground` | hsl(222 18% 14%) | accent 上的文字，与正文一致 |
| border | `--border` | `border-border` | hsl(214 15% 90%) | 极淡灰边界，分隔轻柔 |

**语义色提示**:
- 成功（资产增长/正向操作）: bg hsl(142 45% 95%) / border hsl(142 38% 85%) / text hsl(142 65% 30%)
- 警告（汇率异常/提示）: bg hsl(42 85% 95%) / border hsl(42 75% 82%) / text hsl(38 80% 35%)
- 错误（删除确认/输入错误）: bg hsl(0 75% 96%) / border hsl(0 68% 88%) / text hsl(0 70% 42%)
- 语义色饱和度均控制在 40-80% 区间，与 primary 的高饱和风格对齐，保持视觉统一

## 4. 字体与节奏

- **font-display**: Inter —— 接近 SF Pro 的现代无衬线，疏朗干净，符合苹果系气质
- **font-body**: Inter, Noto Sans SC —— 正文清晰易读，中文使用 Noto Sans SC 保持风格一致；数字与金额使用 `font-variant-numeric: tabular-nums` 实现等宽效果
- **字号**: 总资产标题 text-4xl ~ text-5xl（tabular-nums）；卡片标题 text-lg ~ text-xl；正文 text-base；辅助文字 text-sm
- **圆角**: 大（rounded-xl / rounded-2xl）—— 匹配 iOS/macOS 卡片风格，亲和不生硬

## 5. 全局布局契约

- **Reference Layout Use**: 按需求结构推导，顶部概览 + 中部双图表 + 底部记录列表
- **Page / Section Order**: 顶部导航栏（含汇率设置入口）→ 总资产概览卡片 → 饼图 + 折线图并排 → 资产录入表单 → 历史记录列表
- **Standard Content Zone**: `max-w-5xl` + `mx-auto`，适合中等密度数据展示
- **Shell / Frame Alignment**: 同宽，内容区与导航栏内容对齐，统一受 max-w 约束
- **Padding & Rhythm**: `px-4 md:px-6 py-8 md:py-10`，区块间距 gap-6 ~ gap-8
- **Full-bleed Zones**: 顶部导航栏背景全宽并使用 backdrop-blur 毛玻璃效果，内部内容仍受 Standard Content Zone 约束
- **Local Narrowing**: 资产录入表单可在容器内收窄至 `max-w-2xl` 居中
- **Overflow Strategy**: 记录列表在移动端使用横向滚动或调整列；图表容器固定比例自适应
- **Flexibility Boundary**: 允许移动端调整卡片内边距和图表列数；不允许改动圆角、主色、阴影语言和字体风格

## 6. 视觉与动效

- **装饰**: 毛玻璃、极细分隔线、轻量背景色阶
- **阴影/边界**: 轻 —— 卡片用 `shadow-sm`，悬停时 `shadow-md`，边界极淡
- **动效**: 克制精致 —— hover 有 150ms 颜色过渡，列表项增删有轻微位移和淡入淡出，图表加载有渐入效果；避免夸张弹跳或旋转

## 7. 组件原则

- 按钮、输入框、表格行、菜单项必须有 Default / Hover / Active / Focus-visible / Disabled 五种状态
- Primary 按钮承担录入、保存等主行动；Secondary/Outline 用于编辑、取消等次行动；Ghost 用于删除、更多操作
- 金额输入框支持表达式计算，失焦后自动求值并显示结果，计算过程用 muted 色文字提示
- 空状态、加载状态延续玻璃卡片风格，使用同色系占位骨架屏，不回退到默认样式

## 8. Image Direction

- **Image Role**: 无
- **Image Art Direction**: 无强制图片需求，优先通过排版、色彩和图表本身建立视觉记忆点
- **Image Prompt Keywords**: 无
- **Image Avoidance**: 避免通用金融素材图、金币钞票插图、无意义商务人物照片

## 9. Anti-patterns

- **Split personality**: 顶部用 iOS 风、表格用默认 SaaS 风；全站统一系统蓝 + 大圆角 + 轻阴影语言
- **Phantom tokens**: 编造不存在的 CSS 变量；只使用定义好的 9 个基础 token，语义色通过 utility class 使用
- **Default SaaS drift**: 回到默认深蓝 + 紫色渐变 + 厚重卡片；坚持苹果系浅灰底 + 白卡片 + 系统蓝的轻盈感
- **Invisible interaction**: 只做了 hover，忘记 focus-visible；所有可交互元素必须有清晰的键盘焦点环
- **Mono-hue tyranny**: 主色同时用在按钮、tab、icon、边框、链接、图表上；primary 只留给 CTA 和关键状态，其余用 accent 和中性色
- **Status color drift**: 成功/警告/错误色饱和度飙到 90%+，刺眼突兀；语义色饱和度与 primary 对齐，保持克制