import { useCallback, useEffect, useRef } from "react";

/**
 * 每次调用返回新的 AbortSignal，并取消上一次未完成的请求。
 * 组件卸载时自动 abort，避免泄漏与竞态。
 */
export function useAbortableRequest() {
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      ctrlRef.current?.abort();
      ctrlRef.current = null;
    };
  }, []);

  const nextSignal = useCallback(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = new AbortController();
    return ctrlRef.current.signal;
  }, []);

  return nextSignal;
}
