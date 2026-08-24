# 资产分布 · Asset Dashboard

> 一款**纯本地、零上传、开箱即用**的个人资产可视化工具。录入资产，一眼看清结构与增长趋势。

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ 为什么用它

| 痛点 | 本工具的解法 |
|------|-------------|
| 记账 App 要注册、要联网、数据在别人服务器 | **100% 本地存储**，不注册、不上传、不追踪 |
| 多币种资产换算麻烦 | 内置 **USD/CNY 双币种**，一键拉取实时汇率，自动折算 |
| 加减金额要心算 | 金额框支持 **`+` `-` 表达式**，输入 `1000+500-200` 自动求值 |
| 换设备/备份难 | 支持 **JSON 一键导入导出**，数据完全由你掌控 |
| 界面臃肿广告多 | **iOS/macOS 原生风**，毛玻璃 + 大圆角 + 系统蓝，干净克制 |

---

## 🚀 快速开始

只需 3 步，在本地跑起来：

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 构建生产版本
npm run build
```

打开浏览器访问终端提示的本地地址（默认 `http://localhost:5173`），即可开始录入你的第一笔资产。

> **无需后端、无需数据库、无需账号。** 所有数据保存在你本地浏览器的文件存储中。

---

## 🔒 安全与隐私

这是本项目最核心的设计原则，也是它区别于绝大多数在线理财工具的地方。

### 数据主权

- **零上传**：资产记录、汇率、账本配置全部存储在本地，应用不会向任何服务器发送你的资产数据。
- **无账号体系**：不需要邮箱、手机号、第三方登录，打开即用。
- **可导出可迁移**：所有数据以标准 JSON 格式存在，随时备份、迁移、在其他设备导入。
- **开源可审计**：代码完全开源，存储逻辑可逐行审查，没有隐藏的遥测或数据回传。

### 表达式安全

金额输入支持 `+` `-` 运算，但**绝不使用 `eval()`**。实现上采用白名单字符校验 + 正则分词解析：

```
允许字符：数字、小数点、+、-
拒绝：任何字母、括号、乘除、函数调用、连续运算符
```

非法表达式会被拦截并提示，从根源上杜绝代码注入风险。

### 网络请求

应用唯一的外部网络请求是**获取 USD→CNY 实时汇率**（调用公开免费接口 `exchangerate-api.com`），且：

- 仅在你主动点击「更新汇率」时发起；
- 请求体不含任何个人或资产信息；
- 获取失败时自动回退到上次汇率，不影响使用。

你也可以完全手动设置汇率，断开网络也能正常使用。

---

## 📦 核心功能

### 1. 资产概览

顶部卡片实时展示**总资产（人民币统一计价）**、资产条目数、最近更新时间，数据随记录增删即时刷新。

### 2. 双图表可视化

- **类别占比饼图**：环形图展示各类资产金额占比，hover 显示详情，点击图例可切换显示。
- **资产趋势折线图**：按日期聚合总资产变化，一眼看清增长曲线，x 轴为日期、y 轴为总资产。

桌面端左右并排，移动端自动上下堆叠。

### 3. 资产录入（新增 / 编辑）

表单字段：

| 字段 | 说明 |
|------|------|
| 资产名称 | 自定义名称，如「招商银行储蓄卡」「苹果股票」 |
| 类别 | 下拉选择，输入新类别自动创建 |
| 金额 | 支持 `+` `-` 表达式，失焦自动计算 |
| 币种 | 人民币 / 美元 单选 |
| 日期 | 日期选择器，默认今天 |

提交后自动按当前汇率折算为人民币金额写入记录，图表与列表即时刷新。

### 4. 历史记录管理

- 表格展示所有记录（名称、类别、原金额+币种、人民币金额、日期）；
- 支持按日期排序、按类别筛选；
- 每行可编辑、删除（删除前弹出确认 Dialog，防止误操作）。

### 5. 汇率管理

- 顶部显示当前 USD→CNY 汇率及更新时间；
- 点击「更新汇率」调用公开 API 自动获取最新汇率；
- 支持手动输入设置汇率；
- **汇率变更后所有美元资产自动重新折算**，图表同步刷新。

### 6. 多账本 & 数据导入导出

- 支持创建多个账本（如「个人账户」「家庭账户」），一键切换；
- 支持将当前账本导出为 JSON 文件备份；
- 支持从 JSON 文件导入数据，方便换设备或共享模板。

---

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS v4 + CSS 变量主题 |
| UI 组件 | shadcn/ui（Radix UI 原语） |
| 图表 | ECharts（echarts-for-react） |
| 动画 | framer-motion |
| 路由 | react-router-dom v7 |
| 表单 | react-hook-form + zod |
| 图标 | lucide-react |
| 提示 | sonner |

---

## 📁 项目结构

```
src/
├── index.tsx              # 入口（Provider + 样式引入）
├── app.tsx                # 路由配置
├── index.css              # 全局样式 + 主题变量
├── components/
│   ├── Layout.tsx         # 全局布局容器
│   ├── AppHeader.tsx      # 顶部导航栏（含汇率入口）
│   ├── FileStoreGate.tsx  # 本地文件存储门控
│   ├── LedgerSelector.tsx # 账本切换器
│   └── ui/                # shadcn/ui 组件
├── pages/
│   ├── HomePage/          # 资产仪表盘（首页）
│   ├── PhysicalPage/      # 实物资产页
│   └── NotFoundPage/      # 404
├── data/
│   └── asset.ts           # 资产数据模型 + Hooks + 表达式解析
├── hooks/
│   └── use-mobile.ts      # 响应式断点 Hook
└── lib/
    ├── utils.ts           # 工具函数（cn 等）
    └── chart-colors.ts    # 图表配色
```

---

## 💻 开发指南

### 常用命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本到 dist/
npm run typecheck    # TypeScript 类型检查
npm run lint         # 类型检查 + ESLint
npm run lint:eslint  # 仅 ESLint
```

### 路径别名

```typescript
// @/ → src/
import { cn } from "@/lib/utils";

// @shared/ → shared/
import data from "@shared/static/config.json";
```

### 主题变量

主题色定义在 `src/index.css`，通过 `:root` CSS 变量 + Tailwind `@theme` 注册。遵循 iOS/macOS 浅色模式设计语言：

| 用途 | Tailwind 类 |
|------|------------|
| 页面背景 | `bg-background` |
| 卡片背景 | `bg-card` |
| 主文本 | `text-foreground` |
| 次要文本 | `text-muted-foreground` |
| 主色（系统蓝） | `bg-primary` / `text-primary` |
| 强调色 | `bg-accent` |
| 边框 | `border-border` |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交改动：`git commit -m 'Add some feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 发起 Pull Request

提交前请确保 `npm run lint` 通过。

---

## 📄 License

[MIT](LICENSE) — 自由使用、修改、分发。

---

<p align="center">
  <sub>数据在你手里，才是你的资产。</sub>
</p>
