// Helpers jetables pour l'audit 2026-08-09 (copie prod locale, port 3100)
const BASE = "http://localhost:3100";

function parseSetCookies(res) {
  // Node 18+: getSetCookie
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return raw.map((c) => c.split(";")[0]);
}

async function apiLogin(login, password = "recette2026") {
  const jar = new Map();
  const store = (res) => {
    for (const c of parseSetCookies(res)) {
      const [k, ...v] = c.split("=");
      jar.set(k, v.join("="));
    }
  };
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  store(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const body = new URLSearchParams({ csrfToken, login, password, json: "true" });
  const cbRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieHeader() },
    body: body.toString(),
    redirect: "manual",
  });
  store(cbRes);

  const sessionCookie = [...jar.keys()].find((k) => k.includes("session-token"));
  if (!sessionCookie) throw new Error(`Login FAILED for "${login}" (status ${cbRes.status}, location=${cbRes.headers.get("location")})`);

  // Cookies for playwright
  return [...jar.entries()].map(([name, value]) => ({
    name, value, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax",
  }));
}

async function apiFetch(cookies, path, opts = {}) {
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...(opts.headers || {}), Cookie: cookieHeader },
  });
  let json = null;
  try { json = await res.clone().json(); } catch {}
  return { status: res.status, json };
}

async function newPage(browser, cookies, { mobile = true } = {}) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    userAgent: mobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : undefined,
    hasTouch: mobile,
    deviceScaleFactor: mobile ? 3 : 1,
    isMobile: mobile,
  });
  if (cookies) await context.addCookies(cookies);
  const page = await context.newPage();
  const consoleErrors = [];
  const httpErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
  page.on("response", (r) => { if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
  return { context, page, consoleErrors, httpErrors };
}

const OUT = __dirname;
async function snap(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`  [snap] ${name}.png`);
}

module.exports = { BASE, apiLogin, apiFetch, newPage, snap };
