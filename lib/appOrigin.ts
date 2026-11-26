const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function getConfiguredAppOrigin(): string | null {
  const configured = (process.env.APP_URL || "").trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    const localDevelopment = process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
    if ((url.protocol === "https:" || localDevelopment) &&
        !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) {
      return url.origin;
    }
  } catch {
    // Invalid configuration supplies no trusted origin.
  }
  return null;
}
