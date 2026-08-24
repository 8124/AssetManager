import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import FileStoreGate from "@/components/FileStoreGate";
import HomePage from "@/pages/HomePage/HomePage";
import PhysicalPage from "@/pages/PhysicalPage/PhysicalPage";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";

export default function App() {
  useEffect(() => {
    document.title = "资产分布";
  }, []);

  return (
    <FileStoreGate>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="physical" element={<PhysicalPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </FileStoreGate>
  );
}
