"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";

import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { WorkspaceSidebar } from "@/components/app-shell/workspace-sidebar";
import { PageContextBar } from "@/components/app-shell/page-context-bar";
import { demoNavItems } from "./navigation";
import { getAccountDateContext } from "@/lib/dates/time-zone";
import { DEMO_INSTANT, DEMO_TIME_ZONE } from "@/lib/demo/fixtures";
import { PageNotice } from "@/components/ui/page-notice";
import { resetDemo, updateDemo } from "@/actions/demo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DemoRequestGate, restoreDemoData, settleDemoRequest, writeDemoStorage } from "@/lib/demo/browser-session";
import type { DemoData } from "@/lib/demo/calculate";
import { defaultDemoSelection, demoHref, normalizeDemoSelection } from "@/lib/demo/selection";
import type { DemoCommand, DemoSelection } from "@/lib/demo/types";
const DemoDashboard = dynamic(() => import("./dashboard").then((module) => module.DemoDashboard));
const DemoTransactions = dynamic(() => import("./transactions").then((module) => module.DemoTransactions));
const DemoPlanned = dynamic(() => import("./planned").then((module) => module.DemoPlanned));
const DemoInsights = dynamic(() => import("./insights").then((module) => module.DemoInsights));

const storageNotice = "Browser storage is unavailable. Demo edits will last until you reload this page.";

export function DemoWorkspace({ initialData }: { initialData: DemoData }) {
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [resetVersion, setResetVersion] = useState(0);
  const dataRef = useRef(initialData);
  const busyRef = useRef(true);
  const readyRef = useRef(false);
  const pendingHistory = useRef<DemoSelection | null>(null);
  const gate = useRef(new DemoRequestGate());
  const storage = useRef<Storage | null>(null);

  const accept = useCallback((next: DemoData, updateUrl: boolean) => {
    dataRef.current = next; setData(next);
    if (!writeDemoStorage(storage.current, next.snapshot)) setNotice(storageNotice);
    if (updateUrl) window.history.pushState(null, "", demoHref(next.selection));
  }, []);

  const run = useCallback(async (command: DemoCommand, patch: Partial<DemoSelection> = {}, updateUrl = false) => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError("");
    return settleDemoRequest(gate.current,
      () => updateDemo(dataRef.current.snapshot, normalizeDemoSelection({ ...dataRef.current.selection, ...patch }), command), {
        accept(next) { accept(next, updateUrl); if (command.kind !== "calculate") toast.success("Demo updated."); },
        error: setError, finished() { busyRef.current = false; setBusy(false); },
        failureMessage: "Could not update the demo. Your previous data is unchanged. Please try again.",
      });
  }, [accept]);

  useEffect(() => {
    const requestGate = gate.current;
    try { storage.current = window.sessionStorage; } catch { storage.current = null; }
    void settleDemoRequest(requestGate, async () => ({ ok: true as const, data: await restoreDemoData(storage.current, initialData,
      (snapshot) => updateDemo(snapshot, initialData.selection, { kind: "calculate" })) }), {
      accept(restored) {
        dataRef.current = restored.data; setData(restored.data);
        setNotice(writeDemoStorage(storage.current, restored.data.snapshot) ? restored.notice : storageNotice);
        readyRef.current = true;
        busyRef.current = false; setBusy(false);
        if (pendingHistory.current) {
          const selection = pendingHistory.current; pendingHistory.current = null;
          void run({ kind: "calculate" }, selection);
        }
      },
      error: setError, finished() {},
      failureMessage: "Could not restore your demo edits. Reload to retry, or use Reset demo to start again.",
    });
    return () => { requestGate.invalidate(); };
  }, [initialData, run]);

  useEffect(() => {
    async function onPopState() {
      const selection = normalizeDemoSelection(Object.fromEntries(new URLSearchParams(window.location.search)));
      if (!readyRef.current) { pendingHistory.current = selection; return; }
      // Invalidate the previous request, then restore the addressable selection.
      gate.current.invalidate(); busyRef.current = false;
      const selectionHref = demoHref(selection);
      const ok = await run({ kind: "calculate" }, selection);
      // If calculation failed, keep the URL aligned with the accepted view.
      if (!ok && demoHref(normalizeDemoSelection(Object.fromEntries(new URLSearchParams(window.location.search)))) === selectionHref && !busyRef.current) {
        window.history.replaceState(null, "", demoHref(dataRef.current.selection));
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [run]);

  async function reset() {
    busyRef.current = true; setBusy(true); setError("");
    await settleDemoRequest(gate.current, async () => ({ ok: true as const, data: await resetDemo() }), {
      accept(next) {
        readyRef.current = true; pendingHistory.current = null;
        setNotice(""); accept(next, false); setResetVersion((value) => value + 1);
        window.history.replaceState(null, "", demoHref(defaultDemoSelection)); toast.success("Original sample restored.");
      },
      error: setError, finished() { busyRef.current = !readyRef.current; setBusy(!readyRef.current); }, failureMessage: "Could not reset the demo. Please try again.",
    });
  }

  function navigate(selection: Partial<DemoSelection>) { return run({ kind: "calculate" }, selection, true); }

  const items = demoNavItems(data.selection);
  const activeItem = items.find(item => item.view === data.selection.view)!;
  return <WorkspaceShell
    sidebar={<WorkspaceSidebar items={items} homeHref={items[0].href} activeHref={activeItem.href} disabled={busy} onNavigate={(event, href) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const view = items.find(item => item.href === href)?.view ?? 'dashboard';
      void navigate({ view });
    }} />}
    contextBar={<PageContextBar initialDateContext={getAccountDateContext(DEMO_TIME_ZONE, new Date(DEMO_INSTANT))} timeZone={DEMO_TIME_ZONE} pageLabel={activeItem.label} fixedCalendar />}
  >
    <section aria-label="About this demo" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-accent/40 p-3">
      <div className="flex min-w-0 flex-col gap-1.5"><div className="flex flex-wrap items-center gap-2"><Badge variant="accent">Demo · Sample data</Badge><p className="text-sm font-medium">Example date: <time dateTime="2026-09-15">September 15, 2026</time> · EUR · UTC</p></div><p className="text-sm text-muted-foreground">Edits stay in this tab until you close it and won’t transfer to a new account.</p></div>
      <div className="flex flex-wrap items-center gap-2"><ThemeToggle /><Button variant="outline" onClick={() => void reset()}>Reset demo</Button><Link href="/login" prefetch={false} className={buttonVariants()}>Create your account</Link></div>
    </section>
    <div className="flex flex-col gap-2" aria-live="polite">{notice ? <PageNotice variant="info" title="Demo storage">{notice}</PageNotice> : null}{error ? <div role="alert"><PageNotice variant="error" title="Could not update the demo">{error}</PageNotice></div> : null}{busy ? <p role="status" className="text-sm text-muted-foreground">Updating demo…</p> : null}</div>
    <div aria-busy={busy} key={resetVersion}>
      <h1 className="sr-only">{activeItem.label}</h1>
      {data.selection.view === "dashboard" ? <DemoDashboard data={data} busy={busy} run={run} navigate={navigate} /> : null}
      {data.selection.view === "transactions" ? <DemoTransactions data={data} busy={busy} run={run} navigate={navigate} /> : null}
      {data.selection.view === "planned" ? <DemoPlanned data={data} busy={busy} run={run} navigate={navigate} /> : null}
      {data.selection.view === "insights" ? <DemoInsights data={data} busy={busy} navigate={navigate} /> : null}
    </div>
    <noscript><p className="rounded-lg border border-border p-4">Enable JavaScript to edit the sample data and try demo features.</p></noscript>
  </WorkspaceShell>;
}
