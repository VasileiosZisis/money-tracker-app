export type ActionResult = { ok: true } | { ok: false; error: string };

export type ActionResultWithData<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function actionSuccess(): ActionResult {
  return { ok: true };
}

export function actionSuccessWithData<T>(data: T): ActionResultWithData<T> {
  return { ok: true, data };
}

export function actionError<T = never>(error: string): ActionResultWithData<T> {
  return { ok: false, error };
}

export function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
