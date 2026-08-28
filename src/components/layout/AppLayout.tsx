import { Outlet } from 'react-router-dom';
import { TabBar } from '@/components/layout/TabBar';

/**
 * 全局布局：内容区 + 底部 TabBar。
 * 顶部导航栏由各页面自行引入（AppHeader），保持页面内独立可复用。
 */
export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <div className="pb-14">
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
}
