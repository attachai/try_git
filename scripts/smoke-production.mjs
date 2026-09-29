const baseUrl = process.env.CLOUDFLARE_PRODUCTION_URL?.replace(/\/$/, "");
if (!baseUrl) {
  throw new Error("CLOUDFLARE_PRODUCTION_URL is required for smoke testing.");
}

const health = await fetch(baseUrl + "/api/health", {
  headers: { accept: "application/json" },
});

if (!health.ok) {
  throw new Error("Health check failed with HTTP " + health.status);
}

const body = await health.json();
if (!body?.ok) {
  throw new Error("Health endpoint did not return ok=true");
}

const home = await fetch(baseUrl, { redirect: "manual" });
if (home.status >= 400) {
  throw new Error("Application root failed with HTTP " + home.status);
}

console.log("Production smoke test passed:", baseUrl);
