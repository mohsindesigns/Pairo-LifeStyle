"use client";

import { useSyncExternalStore } from "react";
import { Toaster } from "react-hot-toast";

const noopSubscribe = () => () => {};

// Rendered only after hydration: the toaster's server and client markup differ,
// which made React throw away and rebuild the page on some loads.
export default function ClientToaster(props) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return mounted ? <Toaster {...props} /> : null;
}
