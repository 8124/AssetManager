import { Outlet } from 'react-router-dom';
import TabBar from '@/components/TabBar';

export const Layout = () => {
  return (
    <div       className="min-h-screen bg-[#F2F2F7]">
      <div className="pb-14">
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
};
