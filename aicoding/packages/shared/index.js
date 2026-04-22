export const APP_NAME = 'AI Coding Agent Web MVP';
export const DEFAULT_PROJECT_ID = 'demo-project';

export function createSuccessResponse(data) {
  return {
    ok: true,
    data,
  };
}

export function createErrorResponse(message) {
  return {
    ok: false,
    error: message,
  };
}
