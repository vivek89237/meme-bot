/** Keep the CLI alive even when a provider polls using unreferenced timers. */
export async function run(main: () => Promise<unknown>): Promise<void> {
  const keepAlive = setInterval(() => {}, 1000);
  try {
    await main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : "Command failed");
    process.exitCode = 1;
  } finally {
    clearInterval(keepAlive);
  }
}
