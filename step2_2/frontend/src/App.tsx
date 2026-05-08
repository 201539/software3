import { App as AntApp } from "antd";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { ComparePage } from "./pages/ComparePage";
import { DatasetDetailPage } from "./pages/DatasetDetailPage";
import { DatasetsPage } from "./pages/DatasetsPage";
import { MetricsPage } from "./pages/MetricsPage";
import { RunDetailPage } from "./pages/RunDetailPage";
import { TaskDetailPage } from "./pages/TaskDetailPage";
import { TaskFormPage } from "./pages/TaskFormPage";
import { TaskListPage } from "./pages/TaskListPage";
import { TargetsPage } from "./pages/TargetsPage";

export default function App() {
  return (
    <AntApp>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/tasks" replace />} />
          <Route path="tasks" element={<TaskListPage />} />
          <Route path="tasks/new" element={<TaskFormPage />} />
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="tasks/:taskId/edit" element={<TaskFormPage />} />
          <Route path="runs/:runId" element={<RunDetailPage />} />
          <Route path="targets" element={<TargetsPage />} />
          <Route path="datasets" element={<DatasetsPage />} />
          <Route path="datasets/:datasetId" element={<DatasetDetailPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="metrics" element={<MetricsPage />} />
        </Route>
      </Routes>
    </AntApp>
  );
}
