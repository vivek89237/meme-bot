export function run(main: () => Promise<unknown>): void {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Command failed");
    process.exitCode = 1;
  });
}
