import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import FileStoreGate from '@/components/shared/FileStoreGate';
import { Toaster } from '@/components/ui/sonner';
import AssetsPage from '@/features/assets/AssetsPage';
import PhysicalPage from '@/features/physical/PhysicalPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  // 运行时覆盖平台模板占位标题，保证标签页显示应用名
  useEffect(() => {
    document.title = '资产分布';
  }, []);

  return (
    <>
      <FileStoreGate>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<AssetsPage />} />
            <Route path="physical" element={<PhysicalPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </FileStoreGate>
      <Toaster />
    </>
  );
}
