import { App as AntApp, Spin } from "antd";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";

const TaskListPage = lazy(() =>
  import("./pages/TaskListPage").then((m) => ({ default: m.TaskListPage })),
);
const TaskFormPage = lazy(() =>
  import("./pages/TaskFormPage").then((m) => ({ default: m.TaskFormPage })),
);
const TaskDetailPage = lazy(() =>
  import("./pages/TaskDetailPage").then((m) => ({ default: m.TaskDetailPage })),
);
const RunDetailPage = lazy(() =>
  import("./pages/RunDetailPage").then((m) => ({ default: m.RunDetailPage })),
);
const TargetsPage = lazy(() =>
  import("./pages/TargetsPage").then((m) => ({ default: m.TargetsPage })),
);
const DatasetsPage = lazy(() =>
  import("./pages/DatasetsPage").then((m) => ({ default: m.DatasetsPage })),
);
const DatasetDetailPage = lazy(() =>
  import("./pages/DatasetDetailPage").then((m) => ({ default: m.DatasetDetailPage })),
);
const ComparePage = lazy(() =>
  import("./pages/ComparePage").then((m) => ({ default: m.ComparePage })),
);
const MetricsPage = lazy(() =>
  import("./pages/MetricsPage").then((m) => ({ default: m.MetricsPage })),
);

const suspenseFallback = (
  <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
    <Spin size="large" />
  </div>
);

export default function App() {
  return (
    <AntApp>
      <Suspense fallback={suspenseFallback}>
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
      </Suspense>
    </AntApp>
  );
}
