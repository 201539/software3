import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") ?? "/api/v1";

export const http = axios.create({
  baseURL,
  timeout: 60_000,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((config) => {
  const token = import.meta.env.VITE_API_BEARER_TOKEN?.trim();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const data = err.response?.data as { detail?: unknown } | string | undefined;
    let msg: string = err.message;
    if (typeof data === "string") msg = data;
    else if (data && typeof data === "object" && "detail" in data) {
      const d = data.detail;
      if (typeof d === "string") msg = d;
      else if (Array.isArray(d)) msg = d.map((x) => JSON.stringify(x)).join("; ");
      else if (d != null) msg = JSON.stringify(d);
    }
    return Promise.reject(new Error(msg));
  },
);

/** 与 axios baseURL 一致：无 VITE_API_BASE 时用当前站点的 /api/v1（配合 Vite 代理）。 */
export function wsUrlForRun(runId: number): string {
  const envBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, "");
  if (envBase) {
    return `${envBase.replace(/^http/, "ws")}/ws/evaluation-runs/${runId}`;
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/api/v1/ws/evaluation-runs/${runId}`;
}
