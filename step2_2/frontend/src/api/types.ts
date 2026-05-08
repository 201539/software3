export type TaskStatus =
  | "draft"
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "archived";

export type RunStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export interface PageResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface EvaluationTarget {
  id: number;
  target_code: string;
  target_type: string;
  name: string;
  description: string | null;
  version: string;
  endpoint: string | null;
  adapter_type: string;
  adapter_config: Record<string, unknown>;
  input_schema: Record<string, unknown> | null;
  output_schema: Record<string, unknown> | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface EvaluationTask {
  id: number;
  task_code: string;
  name: string;
  description: string | null;
  target_id: number;
  target_type: string;
  target_version: string;
  dataset_id: number;
  evaluation_method_config: string[];
  metric_config: Record<string, unknown>;
  run_config: Record<string, unknown>;
  input_schema: Record<string, unknown> | null;
  output_schema: Record<string, unknown> | null;
  status: TaskStatus;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EvaluationRun {
  id: number;
  run_code: string;
  task_id: number;
  status: RunStatus;
  progress: number;
  current_sample_id: number | null;
  retry_count: number;
  summary: string | null;
  trace_id: string | null;
  error_message: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SampleResult {
  id: number;
  run_id: number;
  sample_id: number;
  status: string;
  input_snapshot: Record<string, unknown>;
  output_snapshot: Record<string, unknown> | null;
  score_summary: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dataset {
  id: number;
  dataset_code: string;
  name: string;
  description: string | null;
  source_type: string;
  version: string;
  status: string;
  sample_count: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DatasetSample {
  id: number;
  dataset_id: number;
  sample_code: string;
  sample_type: string;
  input_payload: Record<string, unknown>;
  expected_output: Record<string, unknown> | null;
  reference_context: Record<string, unknown> | null;
  ground_truth: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationMethod {
  id: number;
  method_code: string;
  name: string;
  category: string;
  description: string | null;
  config_schema: Record<string, unknown> | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetricDefinition {
  id: number;
  metric_code: string;
  name: string;
  metric_type: string;
  dimension: string;
  description: string | null;
  calc_mode: string;
  config_schema: Record<string, unknown> | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetricResult {
  id: number;
  run_id: number;
  sample_id: number | null;
  metric_id: number;
  metric_code: string | null;
  metric_name: string | null;
  metric_type: string | null;
  metric_value: number | null;
  metric_text: string | null;
  metric_detail: Record<string, unknown> | null;
  created_at: string;
}

export interface TraceRecord {
  id: number;
  run_id: number;
  sample_id: number | null;
  step_index: number;
  phase: string;
  decision: string | null;
  observation: string | null;
  state_snapshot: Record<string, unknown> | null;
  tool_calls: { tool_name: string; success: boolean; duration_ms: number }[] | null;
  created_at: string;
}

export interface ToolCallLog {
  id: number;
  run_id: number;
  sample_id: number | null;
  tool_name: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown> | null;
  success: boolean;
  error_type: string | null;
  duration_ms: number;
  created_at: string;
}

export interface Report {
  id: number;
  run_id: number;
  report_title: string;
  report_summary: string | null;
  report_path: string | null;
  report_format: string;
  created_at: string;
  updated_at: string;
}

export interface AnalysisCompareResult {
  id: number | null;
  analysis_code: string;
  title: string;
  task_ids: number[];
  metric_keys: string[];
  result_summary: string | null;
  result_detail: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RunSummary {
  run_id: number;
  summary: string | null;
  report_title: string | null;
  report_path: string | null;
  report_format: string | null;
}

export interface WebSocketEvent {
  event: string;
  run_id: number;
  status: string | null;
  progress: number | null;
  current_step: number | null;
  message: string | null;
  updated_at: string | null;
}
