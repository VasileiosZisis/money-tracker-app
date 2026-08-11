"use client";

import Link from "next/link";
import * as React from "react";

import { buildEditorStateUrl } from "@/lib/routes/editor-state";

type InlineEditorContextValue = {
  activeEditorId?: string;
  setActiveEditorId: (editorId?: string) => void;
};

const InlineEditorContext = React.createContext<InlineEditorContextValue | null>(
  null,
);

function useInlineEditorContext() {
  const context = React.useContext(InlineEditorContext);

  if (!context) {
    throw new Error("Inline editor controls must be inside InlineEditorProvider.");
  }

  return context;
}

export function InlineEditorProvider({
  children,
  initialEditorId,
  queryParam = "edit",
}: {
  children: React.ReactNode;
  initialEditorId?: string;
  queryParam?: string;
}) {
  const [localState, setLocalState] = React.useState(() => ({
    initialEditorId,
    activeEditorId: initialEditorId,
  }));
  const activeEditorId =
    localState.initialEditorId === initialEditorId
      ? localState.activeEditorId
      : initialEditorId;

  const setActiveEditorId = React.useCallback(
    (editorId?: string) => {
      setLocalState({ initialEditorId, activeEditorId: editorId });
      window.history.replaceState(
        null,
        "",
        buildEditorStateUrl(window.location.href, queryParam, editorId),
      );
    },
    [initialEditorId, queryParam],
  );

  React.useEffect(() => {
    function syncFromHistory() {
      const editorId =
        new URL(window.location.href).searchParams.get(queryParam) ?? undefined;
      setLocalState({ initialEditorId, activeEditorId: editorId });
    }

    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, [initialEditorId, queryParam]);

  const contextValue = React.useMemo(
    () => ({ activeEditorId, setActiveEditorId }),
    [activeEditorId, setActiveEditorId],
  );

  return (
    <InlineEditorContext.Provider value={contextValue}>
      {children}
    </InlineEditorContext.Provider>
  );
}

export function InlineEditorLink({
  children,
  className,
  editorId,
  hideWhenActive = false,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  editorId?: string;
  hideWhenActive?: boolean;
  href: string;
}) {
  const { activeEditorId, setActiveEditorId } = useInlineEditorContext();

  if (hideWhenActive && activeEditorId === editorId) {
    return null;
  }

  return (
    <Link
      href={href}
      scroll={false}
      className={className}
      aria-expanded={editorId ? activeEditorId === editorId : undefined}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        event.preventDefault();
        setActiveEditorId(editorId);
      }}
    >
      {children}
    </Link>
  );
}

export function InlineEditorPanel({
  children,
  editorId,
}: {
  children: React.ReactNode;
  editorId: string;
}) {
  const { activeEditorId } = useInlineEditorContext();

  return activeEditorId === editorId ? children : null;
}

export function useInlineEditor() {
  return useInlineEditorContext();
}
