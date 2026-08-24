1. 架构梳理：单页 Dashboard（无导航 Layout 透传），iOS/macOS 浅色风格，localStorage 持久化，ECharts 饼图+折线图
2. 数据层：建 src/data/asset.ts（类型 + localStorage hooks）+ src/lib/chart-colors.ts（图表 hex 色）
3. 全局 chrome：Layout 保持 Outlet 透传不动，HomePage 自带 Header
4. Page 主体：AssetDashboardPage 分 5 个 section —— Header / Overview / Charts / Form / Records
5. 核心交互：新增/编辑/删除记录、汇率自动获取+手动设置、金额表达式计算、类别筛选排序
6. 写入所有文件并 run_commit 验证