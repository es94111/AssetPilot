import { PublicLanguageSwitcher } from '@/components/i18n/PublicLanguageSwitcher';

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'note' | 'warning'; text: string };

export interface LegalSection {
  icon: string;
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocumentContent {
  title: string;
  subtitle: string;
  icon: string;
  heroClass: string;
  tocTitle: string;
  updatedLabel: string;
  sections: LegalSection[];
  links: {
    href: string;
    icon: string;
    label: string;
  }[];
}

function blockClass(type: LegalBlock['type']) {
  if (type === 'warning') {
    return 'my-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm/7 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300';
  }
  return 'my-4 flex gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm/7 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300';
}

export function LegalDocument({ content }: { content: LegalDocumentContent }) {
  return (
    <div className="public-info-page min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-14 w-full max-w-[900px] items-center justify-between gap-3 px-6">
          <a href="/" className="inline-flex items-center gap-2.5 text-base font-bold text-slate-900 dark:text-slate-100">
            <img src="/logo.svg" alt="AssetPilot" className="h-7 w-7" />
            AssetPilot
          </a>
          <div className="flex items-center gap-3">
            <PublicLanguageSwitcher compact tone="light" />
            <a href="/" className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500 px-3.5 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-600 hover:text-white dark:text-indigo-400">
              <i className="fas fa-arrow-left" />
              {content.links.find((link) => link.href === '/')?.label || 'Home'}
            </a>
          </div>
        </div>
      </nav>

      <div className={`${content.heroClass} px-6 py-14 text-center text-white`}>
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl">
          <i className={`fas ${content.icon}`} />
        </div>
        <h1 className="mb-2.5 text-3xl font-extrabold md:text-4xl">{content.title}</h1>
        <p className="mx-auto max-w-[560px] text-sm/7 text-white/85">{content.subtitle}</p>
      </div>

      <main className="mx-auto w-full max-w-[900px] px-6 py-10 pb-20">
        <div className="mb-10 rounded-2xl border border-slate-200 bg-white px-7 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
            <i className="fas fa-list-ul" /> &nbsp;{content.tocTitle}
          </h2>
          <ol className="grid list-decimal gap-x-6 gap-y-1 pl-5 text-sm text-slate-600 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] dark:text-slate-300">
            {content.sections.map((section, index) => (
              <li key={section.title}>
                <a href={`#s${index + 1}`} className="text-indigo-600 hover:underline dark:text-indigo-400">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </div>

        {content.sections.map((section, index) => (
          <section
            key={section.title}
            className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-9 sm:py-8"
            id={`s${index + 1}`}
          >
            <div className="mb-4 flex items-center gap-2.5 border-b border-slate-200 pb-3.5 text-lg font-bold dark:border-slate-800">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <i className={`fas ${section.icon}`} />
              </span>
              {index + 1}. {section.title}
            </div>
            {section.blocks.map((block, blockIndex) => {
              if (block.type === 'h3') {
                return <h3 key={blockIndex} className="mb-2 mt-4 text-[15px] font-semibold">{block.text}</h3>;
              }
              if (block.type === 'ul') {
                return (
                  <ul key={blockIndex} className="mb-3 list-disc space-y-1.5 pl-5 text-sm/7 text-slate-600 dark:text-slate-300">
                    {block.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                );
              }
              if (block.type === 'note' || block.type === 'warning') {
                return (
                  <div key={blockIndex} className={blockClass(block.type)}>
                    <i className={`fas ${block.type === 'warning' ? 'fa-triangle-exclamation' : 'fa-info-circle'} mt-0.5 shrink-0`} />
                    <span>{block.text}</span>
                  </div>
                );
              }
              return <p key={blockIndex} className="mb-3 text-sm/7 text-slate-600 dark:text-slate-300">{block.text}</p>;
            })}
          </section>
        ))}

        <div className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-400 dark:border-slate-800">
          <p>{content.updatedLabel}</p>
          <div className="mt-2.5 flex flex-wrap justify-center gap-5">
            {content.links.map((link) => (
              <a key={link.href} href={link.href} className="text-indigo-600 dark:text-indigo-400">
                <i className={`fas ${link.icon}`} /> {link.label}
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
