"use client";

import { useReducer, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { initialSetupPreviewState, setupPreviewReducer } from "@/lib/dev/setup-preview";
import { SetupScreen } from "./setup-screen";
import { SetupFields } from "./setup-fields";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function SetupPreview({ timeZones }: { timeZones: string[] }) {
  const ready = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const [state, dispatch] = useReducer(setupPreviewReducer, initialSetupPreviewState);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ready) dispatch({ type: "submit", formData: new FormData(event.currentTarget) });
  }

  return (
    <div className="setup-preview">
      <section aria-label="Setup preview controls" className="setup-preview-toolbar">
        <p className="setup-preview-label">Local setup preview</p>
        <p className="setup-helper">Fictional values only. Changes are not saved</p>
        <div className="setup-preview-controls" role="group" aria-label="Setup version">
          <Button type="button" variant={state.variant === "first-time" ? "default" : "outline"} aria-pressed={state.variant === "first-time"} onClick={() => dispatch({ type: "variant", variant: "first-time" })}>First-time setup</Button>
          <Button type="button" variant={state.variant === "time-zone" ? "default" : "outline"} aria-pressed={state.variant === "time-zone"} onClick={() => dispatch({ type: "variant", variant: "time-zone" })}>Time-zone update</Button>
          <Button type="button" variant="outline" onClick={() => dispatch({ type: "error" })}>Show error</Button>
          <Button type="button" variant="outline" onClick={() => dispatch({ type: "reset" })}>Reset preview</Button>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>Back to dashboard</Link>
        </div>
        <noscript><p className="setup-helper">Enable JavaScript to simulate setup</p></noscript>
      </section>
      <div role="status" aria-live="polite" className="setup-preview-status">
        {state.complete ? <p className="setup-complete">Preview complete — no account changes were saved</p> : null}
      </div>
      <SetupScreen
        variant={state.variant}
        errorMessage={state.errorMessage}
        form={
          <form key={state.revision} onSubmit={handleSubmit} className="setup-form">
            <SetupFields variant={state.variant} selectedCurrency="EUR" initialTimeZone={null} timeZones={timeZones} />
            <Button type="submit" disabled={!ready} className="setup-submit">
              {state.variant === "time-zone" ? "Save and continue" : "Finish setup"}
              <ArrowRight />
            </Button>
          </form>
        }
      />
    </div>
  );
}
