import Image from 'next/image';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getMcpOAuthClient, validateAuthorizationRequest } from '@/lib/mcpOAuth';
import { getMcpOAuthUrls, mcpRedirectUriMatches, MCP_OAUTH_SCOPE, McpOAuthError, oauthErrorBody } from '@/lib/mcpOAuthCore';
import { requireServerAuth } from '@/lib/serverAuth';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function buildReturnTo(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const normalized = first(value);
    if (normalized) query.set(key, normalized);
  }
  return `/oauth/authorize?${query.toString()}`;
}

function ErrorCard({ message, returnTo }: { message: string; returnTo?: string }) {
  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login';
  return (
    <main className="login-bg min-h-screen grid place-items-center p-6">
      <div className="login-card max-w-lg">
        <div className="login-brand">
          <div className="login-logo-ring">
            <Image src="/favicon.svg" alt="AssetPilot" width={32} height={32} />
          </div>
          <h1 className="login-title">無法授權 MCP 連線</h1>
          <p className="login-subtitle">{message}</p>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            如果授權已失效，請<a className="font-medium text-indigo-600 underline dark:text-indigo-400" href={loginHref}>重新登入</a>，再回到 AI 工具重新連線。
          </p>
        </div>
      </div>
    </main>
  );
}

export default async function McpOAuthAuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const returnTo = buildReturnTo(params);
  const clientId = first(params.client_id);
  if (!clientId) return <ErrorCard message="授權請求缺少 client_id。" returnTo={returnTo} />;
  const user = await requireServerAuth(returnTo);

  let client;
  try {
    client = await getMcpOAuthClient(clientId);
  } catch (error) {
    return <ErrorCard message={error instanceof McpOAuthError ? error.message : '無法讀取 MCP client 資訊。'} returnTo={returnTo} />;
  }
  if (!client) return <ErrorCard message="找不到這個 MCP client，請回到 AI 工具重新連線。" returnTo={returnTo} />;
  const requestedRedirectUri = first(params.redirect_uri);
  if (!client.redirect_uris.some((registered) => mcpRedirectUriMatches(requestedRedirectUri, registered))) {
    return <ErrorCard message="MCP client 的返回網址未註冊。" returnTo={returnTo} />;
  }

  const requestHeaders = await headers();
  let authorization;
  try {
    const urls = getMcpOAuthUrls({ headers: requestHeaders });
    authorization = validateAuthorizationRequest({
      client,
      responseType: first(params.response_type),
      redirectUri: first(params.redirect_uri),
      codeChallenge: first(params.code_challenge),
      codeChallengeMethod: first(params.code_challenge_method),
      scope: first(params.scope),
      resource: first(params.resource),
      expectedResource: urls.resource,
    });
  } catch (error) {
    const body = oauthErrorBody(error);
    const target = new URL(requestedRedirectUri);
    target.searchParams.set('error', body.error);
    target.searchParams.set('error_description', body.error_description);
    const state = first(params.state);
    if (state) target.searchParams.set('state', state);
    redirect(target.href);
  }

  const redirectHost = new URL(authorization.redirectUri).host;
  const clientHost = client.client_id.startsWith('https://') ? new URL(client.client_id).host : '';
  const isLoopbackRedirect = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(
    new URL(authorization.redirectUri).hostname
  );

  return (
    <main className="login-bg min-h-screen grid place-items-center p-6">
      <div className="login-card max-w-lg">
        <div className="login-brand">
          <div className="login-logo-ring">
            <Image src="/favicon.svg" alt="AssetPilot" width={32} height={32} />
          </div>
          <h1 className="login-title">允許 MCP 讀取財務資料？</h1>
          <p className="login-subtitle">
            <strong>{client.client_name}</strong> 要以 {user.displayName} 的身分連接 AssetPilot。
          </p>
        </div>

        <div className="my-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <p className="font-semibold">允許的權限</p>
          <p className="mt-1">唯讀查詢交易、帳戶、預算、固定收支及股票資料（{MCP_OAUTH_SCOPE}）。</p>
          <p className="mt-3 break-all text-xs text-slate-500 dark:text-slate-400">
            完成後返回：{redirectHost}
          </p>
          {clientHost && (
            <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">
              Client metadata：{clientHost}
            </p>
          )}
          {isLoopbackRedirect && (
            <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              這是本機 callback；請確認是你剛啟動的 MCP client，避免其他本機程式接收授權結果。
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            此連線無法新增、修改或刪除任何財務紀錄。
          </p>
        </div>

        <form action="/api/oauth/authorize" method="post" className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <input type="hidden" name="client_id" value={client.client_id} />
          <input type="hidden" name="response_type" value="code" />
          <input type="hidden" name="redirect_uri" value={authorization.redirectUri} />
          <input type="hidden" name="code_challenge" value={authorization.codeChallenge} />
          <input type="hidden" name="code_challenge_method" value="S256" />
          <input type="hidden" name="scope" value={authorization.scopes.join(' ')} />
          <input type="hidden" name="resource" value={authorization.resource} />
          <input type="hidden" name="state" value={first(params.state)} />
          <button type="submit" name="decision" value="deny" className="login-btn-google">
            取消
          </button>
          <button type="submit" name="decision" value="allow" className="login-btn-primary">
            允許連線
          </button>
        </form>
      </div>
    </main>
  );
}
