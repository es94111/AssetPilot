'use client';

import { Info, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/components/i18n/I18nProvider';
import Modal from '@/components/ui/Modal';

type ChangelogItem = {
  tag?: string;
  text?: string;
};

type ChangelogRelease = {
  version?: string;
  date?: string;
  title?: string;
  type?: string;
  changes?: ChangelogItem[];
};

type ChangelogData = {
  currentVersion?: string;
  localCurrentVersion?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  availableReleases?: ChangelogRelease[];
  releases?: ChangelogRelease[];
};

export default function VersionInfoButton() {
  const { t } = useT();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [changelog, setChangelog] = useState<ChangelogData | null>(null);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [changelogError, setChangelogError] = useState('');

  async function handleOpenChangelog() {
    setChangelogOpen(true);
    setChangelogError('');
    if (changelog) return;

    setChangelogLoading(true);
    try {
      const resp = await fetch('/api/changelog', { cache: 'no-store' });
      if (!resp.ok) throw new Error(t('shell.changelog.loadFailed'));
      setChangelog(await resp.json());
    } catch (error) {
      setChangelogError(error instanceof Error ? error.message : t('shell.changelog.loadFailed'));
    } finally {
      setChangelogLoading(false);
    }
  }

  const currentVersion = changelog?.localCurrentVersion || changelog?.currentVersion || t('shell.changelog.unknownVersion');
  const latestVersion = changelog?.latestVersion || changelog?.currentVersion || t('shell.changelog.unknownVersion');
  const releasesToShow = (
    changelog?.availableReleases?.length
      ? changelog.availableReleases
      : changelog?.releases || []
  ).slice(0, 10);

  return (
    <>
      <button type="button" onClick={handleOpenChangelog} className="nav-link w-full text-start">
        <Info size={17} aria-hidden="true" />
        <span className="min-w-0 flex-1">{t('shell.versionInfo')}</span>
        <ChevronRight size={16} aria-hidden="true" className="rtl:rotate-180" />
      </button>
      <Modal
        open={changelogOpen}
        onClose={() => setChangelogOpen(false)}
        title={t('shell.versionInfo')}
        className="max-h-[85vh] overflow-hidden"
      >
        {changelogLoading ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('shell.changelog.loading')}</p>
        ) : changelogError ? (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{changelogError}</p>
        ) : (
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-subtle)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('shell.changelog.currentVersion')}</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{currentVersion}</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: 'var(--primary-light-bg)', color: 'var(--primary)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('shell.changelog.updatableVersion')}</p>
                <p className="text-lg font-semibold">{changelog?.updateAvailable ? latestVersion : t('shell.changelog.upToDate')}</p>
              </div>
            </div>
            <p className="mb-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
              {changelog?.updateAvailable ? t('shell.changelog.updatableContent') : t('shell.changelog.recentContent')}
            </p>
            <div className="space-y-4">
              {releasesToShow.map(release => (
                <section key={release.version} className="border-b pb-4 last:border-b-0 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      v{release.version}
                    </h3>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{release.date}</span>
                  </div>
                  {release.title && (
                    <p className="mb-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {release.title}
                    </p>
                  )}
                  <ul className="space-y-1.5">
                    {(release.changes || []).map((change, index) => (
                      <li key={`${release.version}-${index}`} className="flex gap-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                        {change.tag && (
                          <span className="mt-0.5 h-fit rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ background: 'var(--surface-subtle)', color: 'var(--text-muted)' }}>
                            {change.tag}
                          </span>
                        )}
                        <span>{change.text}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
