/** Runs once when the server starts (not during `next build`). */
export async function register() {
  // Keep the import inside this check: it lets the bundler leave database code out of non-Node runtimes.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { bootstrapStore } = await import("./lib/bootstrap");
    await bootstrapStore();
  }
}
