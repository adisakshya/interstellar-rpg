import { defineConfig, devices } from "@playwright/test";

// End-to-end runs of both slice paths (VALIDATION §2, QA-001). The mobile project is Chromium with an iPhone viewport,
// touch and user agent: it is *emulated*, never a physical device, and says nothing about Safari's own rendering.
const executablePath = process.env["PW_CHROMIUM_PATH"];
const launchOptions = {
  // Software GL so WebGL works on headless CI runners.
  // PW_NO_SANDBOX=1 is for running as root in a container; CI does not need it.
  args: [
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    ...(process.env["PW_NO_SANDBOX"] ? ["--no-sandbox"] : []),
  ],
  ...(executablePath ? { executablePath } : {}),
};
const PORT = 4173;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}/interstellar-rpg/`, trace: "off", launchOptions },
  webServer: {
    command: `npx vite build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/interstellar-rpg/`,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } },
    { name: "mobile-emulated", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
});
