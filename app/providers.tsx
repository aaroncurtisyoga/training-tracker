"use client";

import { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

// ClerkProvider is here for the sign-in page. The tracker itself reads auth
// server-side only, and it has no theme provider on purpose: it is dark-only,
// so there is nothing to toggle.
export function Providers({ children }: { children: ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
