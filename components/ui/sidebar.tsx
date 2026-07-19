"use client";

import * as React from "react";
import { PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH = "16.5rem";
const SIDEBAR_WIDTH_MOBILE = "17rem";
const MOBILE_BREAKPOINT = 1024;

type SidebarContextValue = {
  isMobile: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export function useSidebar() {
  const context = React.useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

type SidebarProviderProps = React.HTMLAttributes<HTMLDivElement> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);

  const open = openProp ?? internalOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (openProp === undefined) {
        setInternalOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [onOpenChange, openProp],
  );

  React.useEffect(() => {
    if (!isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile]);

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((value) => !value);
      return;
    }

    setOpen(!open);
  }, [isMobile, open, setOpen]);

  const contextValue = React.useMemo<SidebarContextValue>(
    () => ({
      isMobile,
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [isMobile, open, openMobile, setOpen, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-provider"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-mobile": SIDEBAR_WIDTH_MOBILE,
            ...style,
          } as React.CSSProperties
        }
        className={cn("w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

type SidebarProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: "left" | "right";
  variant?: "sidebar" | "inset";
};

export const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ side = "left", variant = "sidebar", className, children, ...props }, ref) => {
    const { isMobile, open, openMobile, setOpenMobile } = useSidebar();

    const containerClassName = cn(
      "flex h-full w-full flex-col border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-surface backdrop-blur-xl",
      variant === "inset" ? "rounded-2xl" : "rounded-none",
      className,
    );

    if (isMobile) {
      return (
        <>
          <div
            aria-hidden={!openMobile}
            className={cn(
              "fixed inset-0 z-40 bg-background/55 backdrop-blur-sm transition-opacity lg:hidden",
              openMobile ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            onClick={() => setOpenMobile(false)}
          />
          <div
            data-slot="sidebar-mobile"
            className={cn(
              "fixed inset-y-0 z-50 w-[--sidebar-width-mobile] transition-transform duration-200 ease-out lg:hidden",
              side === "left" ? "left-0" : "right-0",
              openMobile
                ? "translate-x-0"
                : side === "left"
                  ? "-translate-x-full"
                  : "translate-x-full",
            )}
          >
            <div
              ref={ref}
              role="dialog"
              aria-modal="true"
              className={containerClassName}
              {...props}
            >
              {children}
            </div>
          </div>
        </>
      );
    }

    return (
      <aside
        data-slot="sidebar"
        className={cn(
          "hidden shrink-0 lg:block",
          open ? "w-[--sidebar-width]" : "w-0 overflow-hidden",
        )}
      >
        <div
          ref={ref}
          className={cn(
            "sticky top-0 h-screen",
            side === "right" ? "ml-auto" : "",
            !open && "pointer-events-none opacity-0",
          )}
          {...props}
        >
          <div className={containerClassName}>{children}</div>
        </div>
      </aside>
    );
  },
);

Sidebar.displayName = "Sidebar";

export const SidebarInset = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sidebar-inset"
      className={cn("min-w-0 flex-1", className)}
      {...props}
    />
  ),
);

SidebarInset.displayName = "SidebarInset";

export const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      className={cn("rounded-lg border-border/70 bg-card/80", className)}
      onClick={toggleSidebar}
      aria-label="Toggle navigation"
      {...props}
    >
      <PanelLeft />
    </Button>
  );
});

SidebarTrigger.displayName = "SidebarTrigger";

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sidebar-header" className={cn("px-3 py-4", className)} {...props} />
  ),
);

SidebarHeader.displayName = "SidebarHeader";

export const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sidebar-content"
      className={cn("flex flex-1 flex-col overflow-y-auto px-3 pb-4", className)}
      {...props}
    />
  ),
);

SidebarContent.displayName = "SidebarContent";

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sidebar-footer"
      className={cn("px-3 pb-4 pt-2", className)}
      {...props}
    />
  ),
);

SidebarFooter.displayName = "SidebarFooter";

export const SidebarGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sidebar-group" className={cn("mt-3", className)} {...props} />
  ),
);

SidebarGroup.displayName = "SidebarGroup";

export const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="sidebar-group-content"
    className={cn("flex flex-col gap-1", className)}
    {...props}
  />
));

SidebarGroupContent.displayName = "SidebarGroupContent";

export const SidebarMenu = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-slot="sidebar-menu"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  ),
);

SidebarMenu.displayName = "SidebarMenu";

export const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} data-slot="sidebar-menu-item" className={cn("list-none", className)} {...props} />
  ),
);

SidebarMenuItem.displayName = "SidebarMenuItem";

function mergeEventHandlers<E>(
  original?: (event: E) => void,
  incoming?: (event: E) => void,
) {
  return (event: E) => {
    original?.(event);
    incoming?.(event);
  };
}

type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactElement;
};

function Slot({ children, className, onClick, ...props }: SlotProps) {
  const element = children as React.ReactElement<Record<string, unknown>>;
  const childProps = element.props as React.HTMLAttributes<HTMLElement>;

  return React.cloneElement(element, {
    ...props,
    ...childProps,
    onClick: mergeEventHandlers(childProps.onClick, onClick),
    className: cn(className, childProps.className),
  });
}

type SidebarMenuButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string;
};

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(({ asChild = false, isActive = false, className, children, ...props }, ref) => {
  const menuButtonClassName = cn(
    "group/menu-button flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
    isActive
      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-floating"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
    className,
  );

  if (asChild && React.isValidElement(children)) {
    return (
      <Slot
        data-slot="sidebar-menu-button"
        data-active={isActive}
        className={menuButtonClassName}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      data-slot="sidebar-menu-button"
      data-active={isActive}
      className={menuButtonClassName}
      {...props}
    >
      {children}
    </button>
  );
});

SidebarMenuButton.displayName = "SidebarMenuButton";
