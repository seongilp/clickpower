import { defineConfig } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3001";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: { baseURL: `http://localhost:${port}`, viewport: { width: 1400, height: 900 } },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : { command: `pnpm dev --port ${port}`, port: Number(port), reuseExistingServer: true, timeout: 60_000 },
});
