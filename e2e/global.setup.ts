import { clerkSetup } from "@clerk/testing/playwright";

async function globalSetup() {
  // The gate specs need no credentials — they assert that signed-out traffic is
  // turned away, which is exactly the state a bare checkout is already in.
  if (process.env.CLERK_PUBLISHABLE_KEY) {
    await clerkSetup();
  }
}

export default globalSetup;
