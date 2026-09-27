import Image from 'next/image';

export function AppCallbackStatus({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="app-callback-page">
      <section className="app-callback-card" aria-labelledby="app-callback-title">
        <div className="app-callback-brand">
          <Image src="/favicon.svg" alt="" width={40} height={40} />
          <span>AssetPilot</span>
        </div>
        <h1 id="app-callback-title">{title}</h1>
        {message !== title && <p role="status" aria-live="polite">{message}</p>}
        {children}
      </section>
    </main>
  );
}
