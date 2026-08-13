import type { Metadata } from 'next';
import { LegalDocument, type LegalDocumentContent } from '@/components/public/LegalDocument';

export const metadata: Metadata = {
  title: 'MCP 與 OAuth — AssetPilot',
  description: 'AssetPilot MCP 端點、OAuth discovery、client registration 與唯讀權限說明。',
};

const content: LegalDocumentContent = {
  title: 'AssetPilot MCP / OAuth',
  subtitle: '供 ChatGPT、Codex 與其他 MCP client 使用的公開連線與授權說明。',
  icon: 'fa-plug',
  heroClass: 'bg-gradient-to-br from-indigo-700 via-violet-700 to-slate-900',
  tocTitle: '連線文件',
  updatedLabel: '更新日期：2026 年 7 月 29 日 · MCP Authorization 2025-11-25',
  links: [
    { href: '/', icon: 'fa-house', label: '首頁' },
    { href: '/settings/mcp', icon: 'fa-gear', label: '登入後管理 MCP' },
    { href: '/privacy', icon: 'fa-shield-halved', label: '隱私權政策' },
  ],
  sections: [
    {
      icon: 'fa-link',
      title: '連線設定',
      blocks: [
        { type: 'p', text: 'MCP Streamable HTTP endpoint 是本站 origin 下的 /api/mcp。所有 MCP 請求都必須使用 Authorization: Bearer 存取權杖。' },
        {
          type: 'ul',
          items: [
            'OAuth scope：mcp:read',
            '工具權限：僅查詢登入使用者自己的 AssetPilot 資料',
            '工具行為：唯讀、不刪除或覆寫資料、不向使用者帳戶外發布內容',
            '舊有 AssetPilot MCP PAT 仍可供一般 MCP client 使用；OpenAI plugin 使用 OAuth 2.1',
          ],
        },
      ],
    },
    {
      icon: 'fa-compass',
      title: 'OAuth discovery',
      blocks: [
        {
          type: 'ul',
          items: [
            'Protected Resource Metadata：/.well-known/oauth-protected-resource/api/mcp',
            'Authorization Server Metadata：/.well-known/oauth-authorization-server',
            'Dynamic Client Registration：/api/oauth/register',
            'Authorization endpoint：/oauth/authorize',
            'Token endpoint：/api/oauth/token',
            'Revocation endpoint：/api/oauth/revoke',
          ],
        },
        { type: 'note', text: '未登入或權杖無效時，MCP endpoint 會回傳 HTTP 401 與 WWW-Authenticate，並指向 Protected Resource Metadata；AI 工具通常會自動重新授權。若授權被撤銷或 refresh token 過期，請重新登入 AssetPilot，再回到 AI 工具重新連線。正常登出 AssetPilot 不會撤銷既有 MCP OAuth 授權。' },
      ],
    },
    {
      icon: 'fa-id-card',
      title: 'Client registration',
      blocks: [
        { type: 'p', text: 'Authorization Server 同時宣告 Client ID Metadata Documents（CIMD）與 Dynamic Client Registration（DCR）。OpenAI host 可優先使用 CIMD，或在 plugin builder 選用 DCR。' },
        {
          type: 'ul',
          items: [
            'Public client token authentication method：none；DCR 也支援 client_secret_basic / client_secret_post',
            'Authorization flow：Authorization Code + PKCE S256',
            'CIMD client_id 必須是公開 HTTPS metadata document URL',
            'DCR 與 CIMD 都必須提供精確的 redirect URI；ChatGPT callback URI 由 plugin 管理頁或 client metadata 提供',
            'CIMD 只能使用 public client；需要 client secret 的 client 請使用 DCR。',
          ],
        },
      ],
    },
    {
      icon: 'fa-lock',
      title: '安全限制',
      blocks: [
        {
          type: 'ul',
          items: [
            'authorization 與 token request 必須攜帶完全一致的 resource，指向 /api/mcp',
            'Access token 會驗證有效期、撤銷狀態、scope、resource audience 與使用者狀態',
            'Authorization code 為短效、單次使用，並綁定 client、redirect URI、resource 與 PKCE challenge',
            'Refresh token 每次使用都會輪替；重播舊 token 會撤銷同一 token family',
          ],
        },
        { type: 'warning', text: '只有在你信任 MCP client 與授權頁顯示的 redirect host 時才應同意連線。' },
      ],
    },
  ],
};

export default function McpServiceDocumentationPage() {
  return <LegalDocument content={content} />;
}
