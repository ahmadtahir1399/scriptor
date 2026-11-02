"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconPanel } from "@/components/icons";
import {
  IconMotion,
  type IconMotionHandle,
} from "@/components/motion/IconMotion";

/**
 * The application sidebar primitive.
 *
 * Hand-written rather than pulled in with `npx shadcn add sidebar`, which
 * rewrites `app/globals.css` to inject its own colour variables and would
 * flatten the token block the whole design system rests on. Every colour here
 * comes from `--color-sidebar*` in `globals.css`, so this file cannot render
 * an unapproved colour.
 *
 * State model — ONE source of truth:
 *   desktop  → `open`, mirrored into a cookie so the server can render the
 *              correct width on the very first paint. localStorage cannot do
 *              that, which is why the old `uiStore.sidebarCollapsed` was
 *              retired rather than kept alongside this.
 *   mobile   → `openMobile`, deliberately NOT persisted. A drawer that
 *              restores itself open on a cold load is a bug, not a feature.
 *
 * The two never mix: `toggleSidebar()` dispatches on `isMobile` so one
 * keyboard shortcut and one trigger drive the right thing on both.
 */

const SIDEBAR_COOKIE_NAME = "scriptor.sidebar";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

interface SidebarContextValue {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a <SidebarProvider>.");
  }
  return context;
}

export interface SidebarProviderProps extends React.ComponentProps<"div"> {
  /**
   * Read from the cookie by the route-group layout (a Server Component) and
   * passed down, so the rail renders at its true width on first paint instead
   * of snapping after hydration.
   */
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

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
    (value: boolean) => {
      if (onOpenChange) {
        onOpenChange(value);
      } else {
        setInternalOpen(value);
      }
      // Mirror to the cookie so the next server render agrees with the client.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
    },
    [onOpenChange],
  );

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((value) => !value);
      return;
    }
    setOpen(!open);
  }, [isMobile, open, setOpen]);

  /*
   * Cmd/Ctrl+B. Registering a listener is a subscription, not a synchronous
   * setState, so this is exactly what an effect is for.
   */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  const state = open ? "expanded" : "collapsed";

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      state,
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, openMobile, isMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-wrapper"
        style={style}
        className={cn("flex min-h-dvh w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

export interface SidebarProps extends React.ComponentProps<"div"> {
  side?: "left" | "right";
  collapsible?: "icon" | "none";
}

export function Sidebar({
  side = "left",
  collapsible = "icon",
  className,
  children,
  ...props
}: SidebarProps) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "bg-sidebar text-sidebar-foreground w-sidebar-width flex h-dvh flex-col",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          side={side}
          data-slot="sidebar"
          data-mobile="true"
          className="bg-sidebar text-sidebar-foreground pine-panel w-sidebar-width border-none p-0 [&>button]:hidden"
        >
          {/* Radix requires an accessible name on every Dialog. */}
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="text-sidebar-foreground group peer hidden md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-side={side}
      data-slot="sidebar"
    >
      {/*
       * The gap element. It occupies layout width so `SidebarInset` flows
       * beside the rail; the rail itself is fixed. Animating this rather than
       * the fixed panel keeps the content reflow and the rail slide in sync.
       */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          "w-sidebar-width relative h-dvh bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=icon]:w-sidebar-width-icon",
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          "w-sidebar-width fixed inset-y-0 z-30 hidden h-dvh transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left" ? "left-0" : "right-0",
          "group-data-[collapsible=icon]:w-sidebar-width-icon",
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className="pine-panel border-sidebar-border flex h-full w-full flex-col border-r"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

export function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();
  /*
   * The panel glyph turns over on hover AND on the click that collapses the
   * rail — so the icon previews what the button does before you commit, then
   * performs it. `ButtonProps` extends `ButtonHTMLAttributes`, which carries no
   * `ref`, hence the wrapper rather than the hook; it is safe here because
   * `Button` sizes its glyph with the descendant `[&_svg]`.
   */
  const panel = React.useRef<IconMotionHandle>(null);

  return (
    <Button
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={cn("text-muted hover:text-ink", className)}
      onClick={(event) => {
        onClick?.(event);
        panel.current?.play();
        toggleSidebar();
      }}
      {...props}
    >
      <IconMotion ref={panel} within="button">
        <IconPanel aria-hidden="true" />
      </IconMotion>
    </Button>
  );
}

/**
 * The draggable edge. A wide invisible hit area over a 1px visible line —
 * dragging or clicking it toggles the rail, which is the affordance people
 * reach for before they find the trigger button.
 */
export function SidebarRail({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-slot="sidebar-rail"
      aria-label="Toggle sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle sidebar"
      className={cn(
        "absolute inset-y-0 z-40 hidden w-4 -translate-x-1/2 transition-all ease-linear md:flex",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-ring/60",
        "group-data-[side=left]:-right-4 group-data-[side=right]:left-0",
        "cursor-col-resize",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The content column beside the rail. Owns the page background and the scroll
 * container, so pages never have to think about the sidebar's width.
 *
 * `min-w-0` is load-bearing and not cosmetic. This is a flex child, and a flex
 * child defaults to `min-width: auto` — meaning it refuses to shrink below its
 * content's intrinsic width. Without it the column widens to fit its widest
 * descendant and pushes the whole document sideways: every page scrolled
 * horizontally below 1024px, the topbar included. `overflow-x-hidden` here
 * would only hide that, and would also clip the sticky topbar's popovers.
 * Letting the column actually shrink is the fix; wide content (tables, the PDF
 * viewer) scrolls inside its own container instead.
 */
export function SidebarInset({
  className,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "bg-bg relative flex min-h-dvh min-w-0 flex-1 flex-col",
        className,
      )}
      {...props}
    />
  );
}

/* ── Structure ───────────────────────────────────────────────────────────── */

export function SidebarHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex flex-col gap-2 p-3", className)}
      {...props}
    />
  );
}

export function SidebarContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto p-3",
        /*
         * The collapsed rail is 3.25rem (52px). `p-3` leaves 28px of inner
         * width, but a collapsed menu button is `size-9` (36px) — so the icon
         * tiles were 8px wider than the space they sat in and clipped against
         * the rail edge. 52 − (2 × 8) = 36 fits it exactly.
         */
        "group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:px-2",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn(
        "flex flex-col gap-2 p-3",
        // Same 52px arithmetic as SidebarContent — see the note there.
        "group-data-[collapsible=icon]:px-2",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      className={cn("bg-sidebar-border mx-1 w-auto", className)}
      {...props}
    />
  );
}

export function SidebarGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("relative flex w-full min-w-0 flex-col", className)}
      {...props}
    />
  );
}

/**
 * The eyebrow above each nav group. Fades out rather than unmounting when the
 * rail collapses, so collapsing does not reflow the icons.
 */
export function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      data-slot="sidebar-group-label"
      className={cn(
        "eyebrow text-sidebar-foreground/55 flex h-7 shrink-0 items-center px-2",
        "transition-[margin,opacity] duration-200 ease-linear",
        "group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  );
}

export function SidebarMenu({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
}

export function SidebarMenuItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  );
}

/*
 * A nav row is a CAPSULE, matching the buttons and fields.
 *
 * The row also slides 2px on hover. On a rail where every row is the same
 * pine, a colour shift alone is a weak signal — the small horizontal move is
 * what makes the row feel like it responded to you.
 */
const sidebarMenuButtonVariants = cva(
  cn(
    "peer/menu-button group/button relative flex w-full items-center gap-3 overflow-hidden rounded-full px-3 text-left outline-none",
    "transition-[background-color,color,transform] duration-200 ease-out-quiet",
    "hover:translate-x-0.5",
    "[&>svg]:size-4.5 [&>svg]:shrink-0",
    "focus-visible:ring-sidebar-ring focus-visible:ring-2",
    "disabled:pointer-events-none disabled:opacity-50",
    // Collapsed: a circular icon tile, label clipped away, no slide.
    "group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:hover:translate-x-0",
    "group-data-[collapsible=icon]:[&>span]:hidden",
  ),
  {
    variants: {
      variant: {
        default:
          "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium",
      },
      size: {
        default: "h-10 text-[13.5px]",
        lg: "h-12 text-[13.5px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface SidebarMenuButtonProps
  extends
    React.ComponentProps<"button">,
    VariantProps<typeof sidebarMenuButtonVariants> {
  asChild?: boolean;
  isActive?: boolean;
  /** Shown only while the rail is collapsed, where the label is clipped. */
  tooltip?: string;
}

export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant,
  size,
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const { state, isMobile } = useSidebar();
  const Comp = asChild ? Slot : "button";

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  );

  // A tooltip on an expanded rail would just repeat the visible label.
  if (!tooltip || state !== "collapsed" || isMobile) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A secondary control parked on the right of a nav row — the "…" that opens a
 * row's menu. It is a sibling of the button, not a child: a button inside a
 * button is invalid, and the row itself already navigates.
 *
 * `showOnHover` keeps the rail quiet until you reach for it, but the row must
 * still reveal it on keyboard focus (`group-focus-within`) or the control is
 * unreachable without a mouse.
 */
export interface SidebarMenuActionProps extends React.ComponentProps<"button"> {
  asChild?: boolean;
  showOnHover?: boolean;
}

export function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: SidebarMenuActionProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="sidebar-menu-action"
      className={cn(
        "text-sidebar-foreground/70 absolute top-1/2 right-2 flex aspect-square w-6 -translate-y-1/2 items-center justify-center rounded-full p-0 outline-none",
        "transition-[background-color,color,opacity] duration-200 ease-out-quiet",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:ring-sidebar-ring focus-visible:ring-2",
        "[&>svg]:size-4 [&>svg]:shrink-0",
        // The action has no room on a 36px icon tile.
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "opacity-0 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A count on a nav row. Hidden when collapsed rather than shrunk — a number
 * squeezed onto a 36px icon tile is unreadable and looks like damage.
 */
export function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="sidebar-menu-badge"
      className={cn(
        "text-sidebar-foreground/70 pointer-events-none ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums",
        "bg-sidebar-accent",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
}
