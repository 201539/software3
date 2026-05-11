import { useCallback, useRef } from "react";

/** 防止快速翻页/切页时旧请求晚到覆盖新数据，减少「闪回」与无效渲染 */
export function useLoadRequestId() {
  const idRef = useRef(0);
  const next = useCallback(() => {
    idRef.current += 1;
    return idRef.current;
  }, []);
  const isCurrent = useCallback((id: number) => id === idRef.current, []);
  return { next, isCurrent };
}
