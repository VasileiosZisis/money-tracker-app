import { setupSubmitSchema, timeZoneSchema } from "@/lib/validators/setup";

export type SetupVariant = "first-time" | "time-zone";
export type SetupPreviewState = {
  variant: SetupVariant;
  revision: number;
  errorMessage?: string;
  complete: boolean;
};
export const initialSetupPreviewState: SetupPreviewState = {
  variant: "first-time", revision: 0, complete: false,
};
type PreviewAction =
  | { type: "variant"; variant: SetupVariant }
  | { type: "reset" }
  | { type: "error" }
  | { type: "submit"; formData: FormData };

export function setupPreviewReducer(state: SetupPreviewState, action: PreviewAction): SetupPreviewState {
  if (action.type === "variant" || action.type === "reset") {
    return { variant: action.type === "variant" ? action.variant : state.variant, revision: state.revision + 1, complete: false };
  }
  if (action.type === "error") {
    return { ...state, complete: false, errorMessage: "Preview error — no changes were saved" };
  }
  const parsed = state.variant === "time-zone"
    ? timeZoneSchema.safeParse(action.formData.get("timeZone"))
    : setupSubmitSchema.safeParse({
        currency: action.formData.get("currency"),
        timeZone: action.formData.get("timeZone"),
        createDefaults: action.formData.get("createDefaults") === "on",
      });
  return { ...state, complete: parsed.success, errorMessage: parsed.success ? undefined : parsed.error.issues[0]?.message ?? "Invalid setup input." };
}
