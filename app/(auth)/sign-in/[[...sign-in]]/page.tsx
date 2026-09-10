import { FC } from "react";
import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
};

// Shipped in this app rather than linking to aaroncurtisyoga.com/sign-in so the
// `redirect_url` proxy.ts sets stays host-relative and lands back here.
const Page: FC = () => (
  <main className="flex min-h-dvh items-center justify-center px-4">
    <SignIn />
  </main>
);

export default Page;
