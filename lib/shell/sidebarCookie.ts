import { cookies } from "next/headers";

/**
 * The sidebar's open state, read on the server.
 *
 * A cookie rather than localStorage precisely so this read is possible: the
 * layout can render the rail at its true width during SSR, instead of shipping
 * an expanded rail that snaps closed once hydration reads storage. That flash
 * is why `uiStore.sidebarCollapsed` was retired rather than kept alongside.
 *
 * Absent cookie → open. A first-time visitor should see the navigation.
 */
export const SIDEBAR_COOKIE_NAME = "scriptor.sidebar";

export async function readSidebarDefaultOpen(): Promise<boolean> {
  const store = await cookies();
  return store.get(SIDEBAR_COOKIE_NAME)?.value !== "false";
}
