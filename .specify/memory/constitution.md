<!--
Sync Impact Report
==================
Version change: 1.1.0 → 1.2.0  (MINOR: new principle added)
Modified principles: N/A
Added sections:
  - Core Principles → Principle III: Slash-Style HTTP Path Convention
    (NON-NEGOTIABLE)
Removed sections: None
Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check section
    expanded to include slash-path gate)
  - ✅ .specify/templates/spec-template.md (no structural change needed;
    API path requirements still live in plan/contracts/)
  - ✅ .specify/templates/tasks-template.md (no structural change)
  - ✅ .specify/templates/checklist-template.md (no structural change)
Follow-up TODOs:
  - ✅ `openapi.yaml` 已於 v4.21.0 建立於專案根目錄，`openapi` 欄位
    固定為 `3.2.0`，涵蓋 SRS.md §3.3 列舉之端點。後續新增／修改
    端點須在同一 PR 更新此檔案（見 Principle II 規則 #2）。
  - ✅ Existing `openapi.yaml` and per-feature contracts under
    `specs/**/contracts/**` use only slash paths as of v4.24.0;
    legacy `:verb` styling, if any reappears, must be migrated in the
    same PR per Principle III rule #2.
Notes:
  - This constitution document itself is written in English at maintainer
    request; it is a governance/meta document and is NOT classified as a
    "specification", "plan", or "user-facing documentation" under
    Principle I.
-->

# AssetPilot (資產管理) Constitution

## Core Principles

### I. Traditional Chinese Documentation — NON‑NEGOTIABLE

All specifications, implementation plans, task breakdowns, and user-facing
documentation **MUST** be written in Traditional Chinese (zh-TW).

Scope includes, but is not limited to:

- Feature specifications: `specs/**/spec.md`
- Implementation plans and their derivatives: `specs/**/plan.md`,
  `research.md`, `data-model.md`, `quickstart.md`
- Task breakdowns: `specs/**/tasks.md`
- Contract descriptions: `specs/**/contracts/**`
- Release notes: `title` and `changes[].text` fields in `changelog.json`
- Software Requirements Specification: `SRS.md`
- `README.md` and user operation guides
- User-facing Pull Request / Issue descriptions, release announcements
- Product UI strings

The following MAY remain in English or use English technical terms inline
(not considered violations):

- Source-code identifiers (variables, functions, classes, table and
  column names)
- External API names, library names, environment-variable keys
- Git branch names and commit-message prefixes (e.g. `fix:`, `docs:`)
- Verbatim quotations of third-party error messages
- Governance / meta documents such as this Constitution itself

**Rationale**: The primary users and maintainers of this project are
Traditional Chinese speakers. A uniform documentation language eliminates
context-switching cost, reduces the risk of requirement misreading, and
keeps documentation aligned with the implementation over the long term.

### II. OpenAPI 3.2.0 Contract — NON‑NEGOTIABLE

Every HTTP API exposed by this project **MUST** be described by an
OpenAPI document whose `openapi` field is exactly the string `3.2.0`.
Earlier (`3.0.x`, `3.1.x`) and unreleased pre-release versions are NOT
acceptable substitutes.

Scope includes, but is not limited to:

- The top-level project API contract: `openapi.yaml` (or `openapi.json`)
  at the repository root.
- Per-feature contract documents produced by Spec-Kit:
  `specs/**/contracts/**` — each file that describes an HTTP interface
  MUST declare `openapi: 3.2.0`.
- Any contract shipped to third parties (e.g. Cloudflare API Shield
  schema) — the shipped artifact MUST be either the 3.2.0 source or a
  mechanically-downgraded copy whose downgrade step is recorded in the
  plan's Complexity Tracking table.

Mandatory authoring rules:

1. The `openapi` field MUST be the literal string `3.2.0`. Tools that
   auto-bump the version (e.g. `openapi-generator`, `redocly bundle`)
   MUST be pinned / configured so they do not rewrite this field.
2. New endpoints MUST be added to the contract in the same PR as the
   implementation. A handler without a matching `paths.*` entry is a
   Constitution violation.
3. Breaking changes to an existing endpoint (removal, rename,
   required-field addition, response-shape change) MUST bump the
   contract's `info.version` according to the same semantic-versioning
   rules this Constitution uses for itself.
4. Schemas referenced from multiple operations MUST live under
   `components.schemas` and be referenced via `$ref`; ad-hoc inline
   duplicate schemas are NOT acceptable.
5. Security schemes (JWT cookie, Passkey, Google SSO) MUST be declared
   under `components.securitySchemes` and applied either globally via
   `security` or per-operation; leaving an authenticated endpoint
   without a `security` declaration is a violation.

Exceptions that do NOT count as violations:

- Purely internal, non-HTTP interfaces (e.g. Node.js modules, CLI
  commands, database queries) do not require an OpenAPI description.
- Static-asset routes (`/`, `/login`, `/privacy`, `/terms`, asset
  files under `/public`) do not require OpenAPI entries; the contract
  is limited to JSON/`/api/**` endpoints.

**Rationale**: A single, versioned, machine-readable contract is the
cheapest way to keep the frontend, backend, CI schema checks,
Cloudflare API Shield, and third-party integrators in sync. Pinning
to OpenAPI 3.2.0 — rather than "the latest 3.x" — makes upgrades an
explicit decision with its own PR and its own review, instead of a
silent drift produced by tooling defaults.

### III. Slash-Style HTTP Path Convention — NON‑NEGOTIABLE

Every HTTP path exposed by this project **MUST** use slashes (`/`) as
the only segment separator. The Google AIP-136 colon-style custom-method
notation (`/resource:verb`, e.g. `/api/categories:reorder`) is **NOT**
permitted in this project's routes, OpenAPI documents, or client code.

Scope includes, but is not limited to:

- Express route registrations in `server.js` (and any future router
  modules): `app.<method>('/api/...', handler)`.
- Path keys in the top-level `openapi.yaml` and in every per-feature
  contract under `specs/**/contracts/**`.
- Path strings used by the frontend SPA (`app.js`) when calling
  `fetch` / `XMLHttpRequest`.
- Any documentation (specs, READMEs, quickstart guides) that quotes
  concrete API paths.

Mandatory authoring rules:

1. **Custom methods use a sub-resource segment, not a colon.** Examples:
   - ✅ `POST /api/categories/reorder`
   - ✅ `POST /api/categories/restore-defaults`
   - ✅ `POST /api/transactions/batch-update`
   - ❌ `POST /api/categories:reorder`
   - ❌ `POST /api/transactions:batchUpdate`
2. **No colons inside any path segment.** A colon may only appear in
   the URL between the scheme and authority (e.g. `https://`) or as
   part of a port (e.g. `:3000`). Inside `paths.*` or
   `app.<method>('...')` arguments, colons are forbidden — including
   the Express named-parameter form (`/users/:id`); use OpenAPI / docs
   notation `{id}` and the equivalent Express form `/users/:id` is
   the **only** sanctioned colon usage and remains permitted because
   it is a route-parameter declaration, not a custom-method verb.
3. **Multi-word custom methods use kebab-case.** `restore-defaults`,
   `batch-update`, `force-refresh` — never `restoreDefaults`,
   `batch_update`, or `RestoreDefaults`. This keeps URL casing aligned
   with the rest of the contract and avoids encoding issues on case-
   insensitive caches and proxies.
4. **Plural resource nouns precede the action segment.** The shape is
   `/api/<plural-resource>[/<id>]/<verb-or-sub-resource>`. The verb is
   always the last segment. Skipping the resource collection segment
   (e.g. `/api/reorder-categories`) is forbidden because it breaks the
   resource-oriented hierarchy that the rest of the contract follows.
5. **Lint enforcement.** `npx @redocly/cli lint openapi.yaml` is run
   in CI; if a future ruleset is added that detects colon paths, it
   MUST be set to `error` severity. Until then, code review is the
   gate: any PR introducing a `:`-style custom method MUST be
   rejected.

Exceptions that do NOT count as violations:

- Express route parameters such as `app.get('/api/users/:id', ...)`.
  The colon there is a route-parameter sigil, not a path segment
  character; the wire URL contains `/api/users/<actual-id>` with no
  literal colon.
- Externally hosted third-party URLs that we merely call (e.g. an
  upstream provider that uses `:verb`). We do not own those, and
  they are not part of this project's contract surface.
- Non-HTTP identifiers that happen to contain `:` (e.g.
  `default_key = "expense:餐飲:早餐"` in `deleted_defaults` rows,
  Bearer token prefixes, or `Content-Type: application/json` headers).
  These are not URL paths and are out of scope.

**Rationale**: Express 5 (and underlying `path-to-regexp` v6+) treats
`:` as the leading sigil for route-parameter capture. Embedding a
colon inside a literal path segment — as Google AIP-136 prescribes —
produces brittle, version-dependent matching behaviour that has
historically broken silently across `path-to-regexp` upgrades. Many
HTTP intermediaries (CDN cache keys, log indexers, basic shell
escaping) also treat `:` as a special character, leading to
inconsistent observability. By committing to the slash-only style,
we align with the dominant REST convention used by the rest of this
project's existing endpoints (`/api/transactions/batch-update`, etc.),
keep the contract free of routing-engine corner cases, and make every
path trivially copyable in shell, browser address bar, and log line.

## Development Workflow

1. **Feature-branch first.** Every new feature MUST begin on a dedicated
   feature branch. Spec-Kit creates this branch automatically via the
   `speckit.git.feature` hook. Direct commits to protected branches
   (`main`, `dev`) are forbidden.
2. **Version discipline.** After each change, follow the "版本更新流程"
   section in `CLAUDE.md` to update `changelog.json` and the version
   history in `SRS.md`. Docker tags and Git tags are generated by CI
   from `changelog.json.currentVersion` and MUST NOT be created manually
   in divergence from that source.
3. **Constitution Check.** Every PR MUST pass the Constitution Check
   section of the plan template before merge. Documents that violate
   the language principle, the OpenAPI principle, or the slash-style
   HTTP path convention MUST be returned for revision during review.
4. **Contract-first API changes.** Any PR that adds, removes, or
   materially changes an HTTP endpoint MUST update the corresponding
   OpenAPI 3.2.0 document in the same PR. Implementation-only PRs
   without contract updates MUST be rejected.
5. **Breaking changes.** PRs introducing breaking changes MUST include
   a Traditional-Chinese migration guide in the PR description covering
   database upgrades, API contract changes, and environment-variable
   additions / removals.

## Governance

1. **Supremacy.** This Constitution is the project's highest governance
   document and supersedes all other conventions documents (including
   `CLAUDE.md`, `SRS.md`, `README.md`). In the event of conflict, this
   Constitution prevails; conflicting documents MUST be updated promptly.
2. **Amendment procedure.** Any amendment MUST be submitted via Pull
   Request. The PR description MUST include: (a) the list of amended or
   added principles, (b) the version bump and its rationale, (c) a
   propagation checklist covering spec / plan / tasks templates.
3. **Versioning policy.** Semantic versioning `MAJOR.MINOR.PATCH` applies:
   - **MAJOR**: removal or redefinition of an existing principle that
     invalidates previously valid workflows.
   - **MINOR**: addition of a new principle or section, or a material
     expansion of an existing workflow.
   - **PATCH**: wording fixes, typo corrections, non-semantic polish.
4. **Compliance review.** The PR reviewer MUST confirm that changes do
   not violate this Constitution. Where a violation is genuinely
   necessary, the author MUST record the justification in the plan's
   Complexity Tracking table, or propose a Constitution amendment in a
   separate PR.

**Version**: 1.2.0 | **Ratified**: 2026-04-24 | **Last Amended**: 2026-04-25
