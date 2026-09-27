import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { redirect } from "next/navigation";
import { PublicLanguageSwitcher } from "@/components/i18n/PublicLanguageSwitcher";
import { getSession } from "@/lib/auth";
import { getTranslator } from "@/lib/i18n/getDictionary";
import { resolveLocale } from "@/lib/i18n/resolveLocale";

type T = ReturnType<typeof getTranslator>;

function getFeaturePillars(t: T) {
  return [
    ["finance", t("public.home.pillars.finance.title"), t("public.home.pillars.finance.tag")],
    ["stocks", t("public.home.pillars.stocks.title"), t("public.home.pillars.stocks.tag")],
    ["security", t("public.home.pillars.security.title"), t("public.home.pillars.security.tag")],
    ["selfHosted", t("public.home.pillars.selfHosted.title"), t("public.home.pillars.selfHosted.tag")],
  ].map(([key, title, tag]) => ({
    title,
    tag,
    items: ["one", "two", "three", "four"].map((item) =>
      t(("public.home.pillars." + key + ".items." + item) as Parameters<T>[0]),
    ),
  }));
}

function getStats(t: T) {
  return ["modules", "encryption", "stockSource", "precision"].map((key) => ({
    value: t(("public.home.stats." + key + ".value") as Parameters<T>[0]),
    label: t(("public.home.stats." + key + ".label") as Parameters<T>[0]),
    sublabel: t(("public.home.stats." + key + ".sublabel") as Parameters<T>[0]),
  }));
}

const STACK = [
  "Next.js 16", "React 19", "Tailwind CSS v4", "PostgreSQL",
  "JWT + WebAuthn", "OpenAPI 3.2.0", "Chart.js", "Docker multi-arch",
];

export default async function Home() {
  const session = await getSession();
  const locale = await resolveLocale();
  const t = getTranslator(locale);
  if (session) redirect("/dashboard");

  return (
    <main className="public-home">
      <div className="home-shell">
        <header className="home-header">
          <Link href="/" className="home-brand" aria-label="AssetPilot">
            <img src="/logo.svg" width="42" height="42" alt="" />
            <span><strong>AssetPilot</strong><small>{t("public.home.tagline")}</small></span>
          </Link>
          <div className="home-header-actions">
            <PublicLanguageSwitcher compact tone="light" />
            <Link href="/login" className="home-login-link">{t("public.home.login")}</Link>
            <Link href="/login" className="home-button home-button-small">
              {t("public.home.register")} <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <h1 id="home-title">{t("public.home.headline1")}<span>{t("public.home.headline2")}</span></h1>
            <p className="home-badge"><span aria-hidden="true" />{t("public.home.badge")}</p>
            <p className="home-lead">
              {t("public.home.leadBefore")}
              <strong>{t("public.home.leadStrong")}</strong>
              {t("public.home.leadAfter")}
            </p>
            <div className="home-hero-actions">
              <Link href="/login" className="home-button">
                {t("public.home.startUsing")} <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/login" className="home-text-link">
                {t("public.home.createFirst")} <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="home-hero-aside">
            <div className="home-aside-heading">
              <img src="/favicon.svg" width="32" height="32" alt="" />
              <span>AssetPilot</span>
            </div>
            <p>{t("public.home.preLoginNote")}</p>
            <ul>
              {["openSource", "encrypted", "noCloudLock", "docker", "openapi"].map((key) => {
                const chip = t(("public.home.chips." + key) as Parameters<T>[0]);
                return <li key={key}><Check size={16} aria-hidden="true" />{chip}</li>;
              })}
            </ul>
          </div>
        </section>

        <section className="home-proof" aria-label={t("public.home.whyLabel")}>
          {getStats(t).map((stat) => (
            <div key={stat.label}>
              <strong>{stat.value}</strong><span>{stat.label}</span><small>{stat.sublabel}</small>
            </div>
          ))}
        </section>

        <section className="home-features" aria-labelledby="home-features-title">
          <div className="home-section-intro">
            <h2 id="home-features-title">{t("public.home.whyTitle")}</h2>
            <p>{t("public.home.whyDescription")}</p>
          </div>
          <div className="home-feature-list">
            {getFeaturePillars(t).map((pillar) => (
              <article className="home-feature" key={pillar.title}>
                <div className="home-feature-heading"><span>{pillar.tag}</span><h3>{pillar.title}</h3></div>
                <ul>{pillar.items.map((item) => (
                  <li key={item}><Check size={17} aria-hidden="true" />{item}</li>
                ))}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="home-setup" aria-labelledby="home-setup-title">
          <div>
            <h2 id="home-setup-title">{t("public.home.quickStartTitle")}</h2>
            <p>{t("public.home.quickStartDescription")}</p>
            <ul>{["image", "arch", "health", "keys"].map((key) => (
              <li key={key}>{t(("public.home.quickStartChips." + key) as Parameters<T>[0])}</li>
            ))}</ul>
          </div>
          <div className="home-terminal">
            <div className="home-terminal-bar"><span>docker run</span><span>AssetPilot</span></div>
            <pre><code>{"docker run -d \\\n  --name assetpilot \\\n  -p 3000:3000 \\\n  -v assetpilot-data:/app/data \\\n  es94111/assetpilot:latest"}</code></pre>
          </div>
        </section>

        <section className="home-tech" aria-labelledby="home-tech-title">
          <div><h2 id="home-tech-title">{t("public.home.techTitle")}</h2><p>{t("public.home.techDescription")}</p></div>
          <ul>{STACK.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>

        <footer className="home-footer">
          <p>{t("public.home.footer")}</p>
          <nav aria-label="Footer">
            <Link href="/privacy">{t("public.common.privacy")}</Link>
            <Link href="/terms">{t("public.common.terms")}</Link>
            <Link href="/api-credits">{t("public.common.apiCredits")}</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
