import type { ReactNode } from "react";
import type { SetupVariant } from "@/lib/dev/setup-preview";

export function SetupScreen({ variant, errorMessage, form }: {
  variant: SetupVariant;
  errorMessage?: string;
  form: ReactNode;
}) {
  const isTimeZoneUpdate = variant === "time-zone";

  return (
    <section className="setup-screen" aria-labelledby="setup-title">
      <h1 id="setup-title" className="setup-title">
        {isTimeZoneUpdate ? "Confirm your" : "Set up your"}<br />
        <span>{isTimeZoneUpdate ? "time zone" : "workspace"}</span>
      </h1>
      <p className="setup-description">
        {isTimeZoneUpdate
          ? "Keep your financial day consistent across devices"
          : "A few details to make CashContour yours"}
      </p>
      {errorMessage ? (
        <div role="alert" className="setup-error">
          <p>{isTimeZoneUpdate ? "Time zone could not be saved" : "Setup could not be completed"}</p>
          <p>{errorMessage.replace(/\.+$/, "")}</p>
        </div>
      ) : null}
      {form}
    </section>
  );
}
