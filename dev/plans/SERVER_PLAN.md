# CAFFeiNE Server Plan (`packages/backend/server` Replacement)

> Status: v0.1 draft  
> Scope: New Rust-based, fully-FOSS backend server for CAFFeiNE, compatible with AFFiNE clients and optimized for AI + headless CMS workloads.

---

## 1. Vision & Non‑Goals

### 1.1 Vision

- Deliver a **world‑class, self‑hosted server** for CAFFeiNE that is:
  - Robust, performant, and stable.
  - Easy to configure, deploy, and operate on a single node (Ubuntu LTS, Docker).
  - Step-by-step documentation with template configs for popular hosting services.
  - Architected for **clean extensibility** via plugins and clear public APIs.
- Make CAFFeiNE a **first‑class headless CMS + AI workspace**:
  - Rich, programmable CRUD APIs over documents, blocks, databases, and object types.
  - First‑class automation (webhooks, Deno sandbox, integrations with Zapier/n8n/Make).
  - First‑class AI integration (embeddings, hybrid search, summarization, generation).
- Maintain **compatibility with existing AFFiNE clients and data** while enabling a strictly FOSS, independently implemented backend:
  - Existing AFFiNE users must be able to migrate without losing data.
  - CAFFeiNE clients may be patched to unlock new capabilities.

### 1.2 Non‑Goals (for v1)

- Not a multi‑region, horizontally sharded SaaS from day one.
- Not a “no‑code backend builder”; the focus is on **opinionated**, well‑designed APIs.
- Not a generic identity provider; we integrate with IdPs rather than replacing them.
- Not a full multi‑cloud orchestration platform; target is **single node + simple Docker Compose**, with room to evolve.
- Not a clone of any AFFiNE internal implementation; we only replicate **observable behavior and documented contracts**, never private internals.

---

## 2. High‑Level Architecture

### 2.1 Processes

We ship a **three‑process** architecture, optimized for single‑node deployments but ready to scale later:

1. `gateway` (Rust + axum)

   - Public JSON/HTTP API (REST + OpenAPI).
   - Read‑only GraphQL API (content querying only).
   - WebSocket endpoint for collaboration, proxied to `core`.
   - Auth handling (sessions, tokens, OAuth callbacks).
   - Rate limiting (per workspace, user, IP).
   - TLS termination (or behind reverse proxy).
   - Request routing and capability gating.

2. `core` (Rust)

   - Single **stateful brain** of the system.
   - Responsibilities:
     - Storage: users, workspaces, documents, blocks, databases, ACLs.
     - OT/CRDT engine and presence model.
     - Workspace‑local operations (atomic transactions, migrations).
     - Auth session validation and permission checks.
     - Search indexing orchestration (but not vector search computation).
     - Data import/export orchestration.
   - Exposes a **gRPC API** consumed by `gateway` and `workers`.

3. `workers` (Rust + sidecar runtimes)
   - Background job executor:
     - Outgoing webhooks (with retries).
     - Automation scripts (Deno sandbox).
     - AI tasks (embeddings, summarization, generation).
     - Imports/exports, migrations, cleanup.
     - Scheduled jobs (cron‑like).
   - Connects to `core` via gRPC and to job storage (Postgres or Redis/PG queue).

### 2.2 External Dependencies

- **Database**:
  - Default: **PostgreSQL** (multi‑tenant via `tenant_id` per workspace).
  - Optional: **SQLite** for “portable” single‑user deployments and `.caffeine` bundles.
- **Search Engine**:
  - Default: **Meilisearch** or Typesense.
  - Hybrid search support:
    - Keyword: tokenized and indexed per block.
    - Embeddings: optional integration with AI providers for semantic vectors.
- **AI Providers** (optional, pluggable):
  - OpenAI, Anthropic, Groq, Azure, OpenRouter, etc.
  - Local endpoints (Ollama-like) supported but not prioritized.

### 2.3 Deployment Topology (v1)

- Single node (Ubuntu LTS) running:
  - `gateway` binary.
  - `core` binary.
  - `workers` binary.
  - Sidecars: Postgres, Meilisearch, optional Redis (for queueing) and reverse proxy (nginx/Caddy/traefik).
- Preferred distribution:
  - Docker images + Docker Compose file for local and small‑scale hosting.
  - Systemd unit files for bare‑metal installs.

### 2.4 Binaries, Config & Paths (v1)

- Binaries (Rust workspace targets):
  - `caffeine-gateway` – HTTP/WS/GraphQL entrypoint.
  - `caffeine-core` – gRPC + migrations + admin CLI subcommands.
  - `caffeine-workers` – job runner.
- Config loading order:
  1. Hard‑coded defaults.
  2. `caffeine.toml` in working directory or `/etc/caffeine/caffeine.toml`.
  3. Environment variables (override file):
     - `CAFF_DB_URL` – Postgres connection string.
     - `CAFF_SQLITE_PATH` – optional path for embedded/single‑user mode.
     - `CAFF_MEILI_URL`, `CAFF_MEILI_KEY`.
     - `CAFF_REDIS_URL` (optional, for queue/session).
     - `CAFF_BIND_ADDR` (gateway), `CAFF_CORE_ADDR`, `CAFF_WORKERS_CONCURRENCY`.
     - `CAFF_ENV` (`dev`|`staging`|`prod`), `CAFF_LOG_LEVEL`.
  4. Process flags (e.g., `--config`, `--db-url`) override everything.
- Config struct (Rust) shared via `crates/shared`:

```rust
pub struct AppConfig {
    pub env: Env,
    pub db: DbConfig,
    pub search: SearchConfig,
    pub ai: AiConfig,
    pub http: HttpConfig,
    pub grpc: GrpcConfig,
    pub redis: Option<RedisConfig>,
    pub e2ee_default_on: bool,
}
```

---

## 3. Data Model & IDs

### 3.1 Tenant Model

- **Tenants**: workspaces (teams, personal spaces) keyed by `workspace_id`.
- Global **User** table:
  - Users are global across workspaces (`user_id` stable).
  - Membership table maps `(user_id, workspace_id)` with role (view/comment/edit/admin).
- IDs:
  - `user_id`, `workspace_id`: Postgres `uuid`.
  - Content IDs (documents, blocks): `text` (base58 BLAKE3 or UUID‑7).

### 3.2 Deterministic IDs (BLAKE3)

We use deterministic IDs for blocks and other content where idempotent import is important.

- ID format: base58 encoding of 256‑bit BLAKE3 hash.
- Hash input: canonical JSON of **semantically normalized** content and immutable metadata.
- Canonicalization rules:
  - Only stable, semantic fields included (no ephemeral UI state).
  - Keys sorted lexicographically.
  - Children IDs sorted.

Day‑one reference implementation (language‑agnostic design; re‑implemented in Rust/TS/Go):

```ts
// Day-one decision — copy this exactly in all languages.
id = base58encode(
  blake3_256(
    canonical_json({
      type,
      flavor,
      text: normalizeText(content),
      props: stablePropsOnly(block),
      children: sorted(childIds),
      created_at: block.createdAt,
      created_by: deviceId,
    })
  )
);
```

More explicit version:

```ts
function generateDeterministicId(block: NormalizedBlock): string {
  const input = JSON.stringify(
    {
      type: block.type,
      flavor: block.flavor ?? null,
      text: normalizeText(block.text),
      props: stablePropsOnly(block.props), // exclude collapsed, selection, etc.
      children: block.children.sort(), // sort by existing ID (stable sort!)
      createdAt: block.createdAt, // ms since epoch
      createdBy: block.createdBy ?? null, // device permanent ID
    },
    null,
    0
  ); // canonical JSON (sorted keys)

  const hash = blake3(input, { dkLen: 32 }); // 256-bit
  return base58Encode(hash); // ~43 chars, no 0OIl ambiguity
}
```

We also support a **UUID‑7** strategy for objects where deterministic IDs are not required.

### 3.3 ID Collision Behavior

- On deterministic ID conflict:
  - Default: respond with **HTTP 409 Conflict** and structured error payload.
  - Optional: callers may set an `on_conflict` behavior on certain APIs:
    - `reject` (default).
    - `overwrite` (for trusted import scenarios, like GitHub‑driven sync).

### 3.4 Schema & Migrations

- Schema versioned per workspace and per object.
- Client declares `client_schema_version` on each request/session.
- Server behavior:
  - Performs schema migrations when loading/saving objects.
  - **Never drops unknown fields** – store and re‑emit them untouched (protobuf‑style).
  - Maintains forward/backward compatibility with incremental evolutions.
- Server exposes:
  - `/v1/schema` endpoints for describing block/document schemas.
  - Stable public types for block format (published via OpenAPI + TypeScript).

### 3.5 Parsed Content & Formats

Server‑side parsers handle:

- Canonical CAFFeiNE **Block JSON**.
- Markdown (GFM + tables + task lists + mermaid).
- Notion exports (pages + databases).
- Obsidian/Markdown folders.
- AFFiNE `.affine` exports (only via documented behavior / formats).
- OPML, CSV, HTML.

Parsing is centralized in `core` behind a trait‑based interface, allowing pluggable parsers/importers.

### 3.6 Example Postgres Schema (v1)

> Exact migrations will live in `crates/core/migrations`, but the following is the baseline model.

- `users`
  - `id uuid primary key`
  - `email citext unique not null`
  - `email_verified_at timestamptz`
  - `display_name text`
  - `avatar_url text`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- `user_auth_local`
  - `user_id uuid references users(id) on delete cascade`
  - `password_hash text not null` // argon2id encoded
  - `created_at timestamptz not null default now()`
  - `primary key (user_id)`
- `user_auth_oauth`
  - `id uuid primary key`
  - `user_id uuid references users(id) on delete cascade`
  - `provider text not null` // "google" | "github" | ...
  - `provider_user_id text not null`
  - `profile jsonb`
  - `created_at timestamptz not null default now()`
  - `unique (provider, provider_user_id)`
- `workspaces`
  - `id uuid primary key`
  - `slug text unique`
  - `name text not null`
  - `owner_user_id uuid references users(id)`
  - `e2ee_enabled boolean not null default true`
  - `ai_enabled boolean not null default false`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- `workspace_memberships`
  - `workspace_id uuid references workspaces(id) on delete cascade`
  - `user_id uuid references users(id) on delete cascade`
  - `role text not null` // "viewer" | "commenter" | "editor" | "admin" | "owner"
  - `invited_by uuid references users(id)`
  - `created_at timestamptz not null default now()`
  - `primary key (workspace_id, user_id)`
- `documents`
  - `id text primary key` // deterministic or UUID‑7
  - `workspace_id uuid references workspaces(id) on delete cascade`
  - `title text`
  - `kind text not null` // "page" | "database" | ...
  - `created_by uuid references users(id)`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
  - `deleted_at timestamptz`
  - Indexes: `(workspace_id)`, `(workspace_id, updated_at desc)`
- `blocks`
  - `id text primary key`
  - `document_id text references documents(id) on delete cascade`
  - `workspace_id uuid not null`
  - `parent_id text` // nullable (root)
  - `type text not null`
  - `flavor text`
  - `props jsonb not null` // full props; stable subset used for IDs
  - `children text[] not null default '{}'`
  - `position float8 not null` // ordering hint within parent
  - `created_by uuid references users(id)`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
  - Indexes: `(document_id, parent_id, position)`
- `sessions`
  - `id uuid primary key`
  - `user_id uuid references users(id) on delete cascade`
  - `created_at timestamptz not null default now()`
  - `expires_at timestamptz not null`
  - `ip inet`
  - `user_agent text`
- `api_tokens`
  - `id uuid primary key`
  - `user_id uuid references users(id) on delete cascade`
  - `workspace_id uuid references workspaces(id)`
  - `name text not null`
  - `token_hash text not null`
  - `scopes text[] not null`
  - `created_at timestamptz not null default now()`
  - `last_used_at timestamptz`
- `audit_log`
  - `id bigserial primary key`
  - `workspace_id uuid`
  - `user_id uuid`
  - `event_type text not null` // "auth.login", "workspace.role_changed", ...
  - `payload jsonb not null`
  - `created_at timestamptz not null default now()`
- `jobs`
  - `id bigserial primary key`
  - `queue text not null` // "webhook", "ai", "import", ...
  - `workspace_id uuid`
  - `payload jsonb not null`
  - `run_at timestamptz not null default now()`
  - `attempts int not null default 0`
  - `max_attempts int not null default 5`
  - `status text not null default 'pending'` // "pending" | "running" | "failed" | "completed"
  - `last_error text`
  - Indexes: `(queue, status, run_at)`

---

## 4. Collaboration & Sync

### 4.1 Collaboration Model

- Base model: **Operational Transformation (OT)** over a real‑time protocol.
- Fallback / snapshots: Y.js‑style encoded document snapshots.
- Server is the **immutable event log**:
  - Clients never act as single source of truth.
  - Server stores operation log per document/workspace with vector clocks / Lamport timestamps.

### 4.2 Transports

- WebSocket: **primary** real‑time transport (authenticated sessions).
- SSE: fallback for limited environments.
- HTTP long‑poll: final fallback for degraded connectivity.
- Pure REST polling for collaboration is **out of scope** (too slow and heavy).

### 4.3 Reconnect & Offline Sync

- On reconnect:
  - Client sends local op log since last acknowledged server version.
  - Server:
    - Validates operations.
    - Applies them using 3‑way merge with vector clocks.
    - Persists resolved ops to event log and document state.
    - Sends back conflict resolutions and updated state.

### 4.4 Presence & Awareness

- Presence features (day one):
  - Live cursors and selection.
  - “User is typing” indicators.
  - “User is viewing this page” presence list.
  - Avatar / color assignments.
- No hard locks:
  - Optimistic editing and conflict resolution (Google Docs style).
  - “Suggesting” mode as a later enhancement.

---

## 5. Authentication, Authorization & Identity

### 5.1 Identity & Users

- Global `user` table:
  - Users can belong to many workspaces.
  - Single identity across all workspaces (email plus provider IDs).

### 5.2 Auth Methods (v1)

- Email + password:
  - Password hashing: **argon2id** with modern parameters.
  - Optional 2FA (v2+).
- OAuth2 login:
  - Providers: Google, GitHub (v1).
  - Additional providers (Microsoft, etc.) later via plugin adapters.
- API tokens:
  - Scoped tokens (workspace‑level or global).
  - Personal tokens for automation and CLI use.

Passkeys (WebAuthn), SAML/OIDC enterprise SSO, and magic links are **explicit v2+ features**, built via pluggable adapters.

### 5.3 Sessions & Tokens

- Session tokens:
  - HttpOnly secure cookies for browser clients.
  - JWT or opaque tokens for API consumers.
- Server‑side session store:
  - Backed by Postgres or Redis.
  - Ties together user, workspace, device, and permissions snapshot.

### 5.4 Authorization Model

- Workspace‑level RBAC:
  - Roles: `viewer`, `commenter`, `editor`, `admin`, `owner`.
- Document/collection‑level ACLs:
  - grants as `(principal, resource_id, permission)` tuples.
  - Principals: user, workspace role, group, link token.
- Share‑by‑link:
  - Optional password.
  - Optional expiry.
  - Optional domain restrictions.

### 5.5 Pluggable Auth Architecture

- Auth providers are implemented as plugins with a stable trait:
  - `AuthProvider` for OAuth/OIDC/SAML.
  - `CredentialStore` for local credentials.
  - `SessionStore` for session persistence.
- Designed to mirror NextAuth‑style adapters while remaining Rust‑centric.

### 5.6 Auth Endpoints & Flows (v1)

> Exact payloads will be captured in OpenAPI, but we fix the basic shapes here.

- REST endpoints (gateway):

  - `POST /v1/auth/register`
    - Body: `{ "email": string, "password": string, "name"?: string }`
    - Response: `{ "user": User, "session": { "token": string, "expires_at": string } }`
    - Side effects: creates `users` row + `user_auth_local` + `sessions` row; sets `caff_session` HttpOnly cookie.
  - `POST /v1/auth/login`
    - Body: `{ "email": string, "password": string }`
    - Response: same as register.
  - `POST /v1/auth/logout`
    - Invalidates session in DB and clears cookie.
  - `GET /v1/auth/me`
    - Returns current user + memberships + active workspace.
  - `GET /v1/auth/oauth/:provider/start`
    - Redirects to provider with CSRF/state protection.
  - `GET /v1/auth/oauth/:provider/callback`
    - Exchanges code for token, upserts `users` + `user_auth_oauth`, issues session.
  - `POST /v1/auth/api-tokens`
    - Creates an API token; returns plaintext token once; stores `token_hash` only.

- Cookie & header conventions:
  - Session cookie name: `caff_session`.
  - API token header: `Authorization: Bearer <token>`.
  - CSRF token header for state‑changing browser requests: `X-CSRF-Token` (v2+; optional v1).

---

## 6. Encryption, Security & E2E Model

### 6.1 Security Posture

- TLS everywhere (either in `gateway` or external reverse proxy).
- Modern security headers and best practices:
  - HSTS, CSP, XSS protections, CSRF mitigation where applicable.
- Secure secret management:
  - Environment variables by default.
  - Optional integration with secret stores (future).

### 6.2 E2E vs Server‑Side Encryption

Two workspace modes:

1. **E2E ON (default for private/personal workspaces)**:

   - Document content is encrypted client‑side with a workspace key.
   - Server stores only ciphertext and minimal metadata.
   - Full‑text search:
     - Server indexes deterministic encrypted tokens per block:
       - `token = H(term + workspace_key)` (exact design TBD in crypto spec).
       - Tokens stored in Meilisearch for typo‑tolerant search while preserving privacy.
   - Semantic/vector search:
     - Disabled by default or performed client‑side with local models.
   - AI summarization, slash commands:
     - Disabled by default or performed locally (e.g., browser/Ollama).
   - Real‑time collab:
     - OT/CRDT ops are encrypted in transit and at rest.

2. **E2E OFF (team/enterprise workspaces)**:
   - Server has access to plaintext content.
   - Full hybrid search:
     - Keyword indexing of plaintext.
     - Semantic embeddings.
   - AI features fully enabled (subject to workspace AI config).
   - Same real‑time collaboration model, with faster indexing.

### 6.4 Search Index Model (Shared)

- Meilisearch index naming:
  - `docs_{workspace_id}` for document‑level hits.
  - `blocks_{workspace_id}` for block‑level hits (optional).
- Document index schema (logical):
  - `id`: string – document ID.
  - `workspace_id`: string – redundant guard.
  - `title`: string.
  - `kind`: string – page/database/etc.
  - `snippet`: string – plain text excerpt.
  - `tags`: string[].
  - `created_at`: ISO timestamp.
  - `updated_at`: ISO timestamp.
  - `is_archived`: bool.
  - `permissions`: string[] – coarse‑grained flags like `public`, `workspace`, `private` (used for pre‑filtering).
- Block index schema (logical, if used):
  - `id`: string – block ID.
  - `document_id`: string.
  - `workspace_id`: string.
  - `text`: string – normalized block text.
  - `block_type`: string.
  - `position`: number – numeric sort key.
- Indexing pipeline (plaintext mode):
  1. `core` receives change (doc or block) via OT or REST.
  2. `core` builds a `SearchDoc` struct with normalized fields.
  3. `core` enqueues a `jobs` row in queue `search-index`.
  4. `workers` consumes the job:
     - Transforms to Meilisearch document.
     - Calls Meilisearch `addOrUpdate`.
  5. On delete:
     - Enqueue `search-delete` job with IDs; worker calls `deleteDocument(s)`.
- Indexing pipeline (E2E mode – encrypted tokens):
  1. Client derives per‑term tokens `token_i = H(term_i || workspace_key)` for searchable terms.
  2. Client sends tokens to server as part of encrypted metadata block (design TBD).
  3. `core` stores token arrays in `blocks.props` or dedicated table (e.g., `block_tokens(block_id, tokens text[])`.
  4. `workers` index these tokens into the Meilisearch index as the `tokens` field.
  5. Queries:
     - Client computes query tokens with same function.
     - API receives `tokens[]` instead of `q` string; Meilisearch search uses tokens with typo‑tolerant matching constrained to that field.

### 6.3 Audit Logging & Compliance

- Audit logs are **mandatory**:
  - Log auth events, role/ACL changes, workspace settings, AI config changes, data exports/imports.
  - Stored in an append‑only log table with retention policies.
- Design from day one for SOC2/GDPR:
  - Clear data retention/deletion paths.
  - Per‑workspace data export and deletion.

---

## 7. Headless CMS & Automation

### 7.1 Headless CMS Capabilities (v1)

- Full CRUD APIs for:
  - Documents/pages.
  - Blocks (rich content).
  - Collections/databases.
  - Views, filters, and relations.
- Read‑only GraphQL API for:
  - Content querying (documents, blocks, database rows).
  - Full‑text + semantic search (where enabled).
  - Permissions‑aware results (enforced in `core` for each query).
- User‑definable **object types**:
  - Typed schemas (like Notion databases) with fields and validation.

### 7.2 Automation & Webhooks

- Outgoing webhooks:
  - Triggered on events (document created/updated/deleted, block changes, membership changes, etc.).
  - HMAC‑signed payloads for verification.
  - Retries with exponential backoff.
- Built‑in automation runtime:
  - Sandbox: Deno (TypeScript/JavaScript).
  - Permissions: controlled via a capability manifest (no network/FS/DB unless granted).
  - Used for:
    - Custom workflows.
    - Lightweight ETL.
    - Integration glue logic.
- Third‑party integrations:
  - Zapier, n8n, Make via webhook payloads.
  - Optionally dedicated “app” connectors later.

### 7.3 Scheduled Jobs

- Jobs engine in `workers`:
  - Cron‑like schedules (per instance or per workspace).
  - Use cases:
    - Daily backups.
    - Index rebalancing.
    - AI batch processing (tagging, summarization).
    - Cleanup of expired links, sessions.

### 7.4 Search API Shapes (REST & GraphQL)

- REST search:
  - `GET /v1/workspaces/{workspace_id}/search`
    - Query params:
      - `q`: string – raw query (plaintext mode only).
      - `tokens`: string[] – query tokens (E2E mode).
      - `kind`: filter for document type.
      - `limit`, `offset` or `cursor`.
    - Response:
      - `{ "hits": SearchHit[], "next_cursor"?: string }`.
      - `SearchHit`:
        - `doc_id`, `title`, `kind`, `snippet`, `score`, `path` (breadcrumbs), `highlight` (optional).
- GraphQL search:
  - Field example:
    - `searchDocuments(workspaceId: ID!, query: String, tokens: [String!], kind: String, first: Int, after: String): SearchConnection!`
  - Resolvers:
    - Delegate search to `core` which wraps Meilisearch.
    - Apply permission filters in `core` before returning results.

---

## 8. AI Integration

### 8.1 Capabilities

- Embeddings + hybrid search.
- Summarization / outline generation.
- Auto‑tagging and classification.
- Slash commands and template‑driven generation.
- Direct document/data editing via AI (AI acts as assistant that emits operations).

### 8.2 Provider Model

- Pluggable provider interface:
  - Providers: OpenAI, Anthropic, Groq, Azure, OpenRouter, local HTTP endpoints.
  - Each provider implements capabilities: chat, embeddings, summarization, moderation, etc.
- Per‑workspace (or per‑instance) encrypted AI config:
  - Provider name.
  - Base URL and API key.
  - Default model per capability (chat, embedding, summarization).
  - Temperature/top_p defaults.
  - Safety presets (off/moderate/strict).
  - Admin consent flag: “allow sending data to external LLMs”.
  - Optional spending limits and rate limits.

#### 8.2.1 AI Config Schema (DB)

- `ai_workspaces_config`
  - `workspace_id uuid primary key references workspaces(id) on delete cascade`
  - `enabled boolean not null default false`
  - `provider text not null` // "openai" | "anthropic" | "groq" | "custom" | ...
  - `config jsonb not null` // encrypted in app layer if needed
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- Logical `AiWorkspaceConfig` struct:

```rust
pub struct AiWorkspaceConfig {
    pub enabled: bool,
    pub provider: String,
    pub provider_display_name: Option<String>,
    pub chat_model: Option<String>,
    pub embedding_model: Option<String>,
    pub summarization_model: Option<String>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub safety_preset: SafetyPreset, // Off | Moderate | Strict
    pub allow_external_llm: bool,
    pub spend_cap_monthly_usd: Option<f32>,
    pub rate_limit_per_minute: Option<u32>,
}
```

#### 8.2.2 AiProvider Trait (Core)

```rust
#[async_trait::async_trait]
pub trait AiProvider: Send + Sync {
    fn name(&self) -> &'static str;

    async fn chat(
        &self,
        ctx: &AiRequestContext,
        request: ChatRequest,
    ) -> anyhow::Result<ChatResponse>;

    async fn embed(
        &self,
        ctx: &AiRequestContext,
        request: EmbedRequest,
    ) -> anyhow::Result<EmbedResponse>;

    async fn summarize(
        &self,
        ctx: &AiRequestContext,
        request: SummarizeRequest,
    ) -> anyhow::Result<SummarizeResponse>;
}

pub struct AiRequestContext {
    pub workspace_id: Uuid,
    pub user_id: Uuid,
    pub config: AiWorkspaceConfig,
    pub span: tracing::Span,
}
```

`core` maintains a registry `AiProviderRegistry` mapping provider name → implementation, configured at startup.

### 8.3 API Surface

- Dedicated `/v1/ai/*` endpoints:
  - `/v1/ai/chat`.
  - `/v1/ai/embed`.
  - `/v1/ai/summarize`.
  - `/v1/ai/assist-edit`.
  - All rate‑limited per workspace/user.
- AI is a **first‑class** component; deeply integrated with search, automation, and headless APIs.

#### 8.3.1 REST Shapes (High‑Level)

- `POST /v1/ai/chat`
  - Body:
    - `{ "workspace_id": string, "messages": ChatMessage[], "tools"?: ToolDef[], "mode"?: "stream" | "batch" }`
  - Response:
    - Non‑stream: `{ "messages": ChatMessage[], "usage": TokenUsage }`.
    - Stream: `text/event-stream` or WS with incremental deltas.
- `POST /v1/ai/embed`
  - Body: `{ "workspace_id": string, "texts": string[], "target": "document" | "block" | "custom" }`
  - Response: `{ "vectors": number[][], "model": string }`.
- `POST /v1/ai/summarize`
  - Body: `{ "workspace_id": string, "document_id": string, "mode"?: "short" | "detailed" }`
  - Response: `{ "summary": string }`.
- `POST /v1/ai/assist-edit`
  - Body: `{ "workspace_id": string, "document_id": string, "instructions": string }`
  - Response: `{ "ops": OtOps[], "preview"?: string }` – client can apply ops.

#### 8.3.2 Embedding Storage

- `embeddings`
  - `id bigserial primary key`
  - `workspace_id uuid not null`
  - `document_id text`
  - `block_id text`
  - `kind text not null` // "document" | "block" | "custom"
  - `model text not null`
  - `dim int not null`
  - `vector bytea` // or pgvector type if available
  - `payload jsonb` // arbitrary metadata (e.g., snippet)
  - Indexes: `(workspace_id, document_id)`

Workers:

- `workers` consumes `jobs` from `queue = 'ai-embed'` to:
  - Fetch content from `core`.
  - Call provider `embed`.
  - Insert/update embeddings row(s).

---

## 9. API Design

### 9.1 Protocols

- Public:
  - REST + JSON (primary).
  - OpenAPI spec for REST endpoints.
  - GraphQL (read‑only v1, content querying only).
- Internal:
  - gRPC between `gateway` ↔ `core` and `workers` ↔ `core`.

### 9.2 Versioning

- URL prefix versioning:
  - `/v1/*`, `/v2/*` etc.
  - Breaking changes require new version; old versions receive sunset schedules.

### 9.3 GraphQL Scope (v1)

- Queries only:
  - Fetch documents, blocks, collections, views.
  - Permissions‑aware search results.
  - Full‑text and semantic search queries.
- All mutations, subscriptions, auth, uploads, AI, and presence:
  - Remain REST + WebSocket only in v1.
  - GraphQL mutations/subscriptions considered for v2+ after schema hardening.

### 9.4 Rate Limiting

- Leaky bucket (or token bucket) implementation in `gateway`.
- Dimensions:
  - Per workspace.
  - Per user.
  - Per IP.
- Configurable defaults per deployment.

### 9.5 Concrete Endpoint Map (v1, Non‑Exhaustive)

> This list is to guide initial implementation; OpenAPI will be the source of truth.

- Health & meta
  - `GET /v1/health` → `{ status: "ok", version: string }`
  - `GET /v1/version` → build metadata.
- Workspaces
  - `GET /v1/workspaces` – list workspaces for current user.
  - `POST /v1/workspaces` – create workspace.
  - `GET /v1/workspaces/{workspace_id}` – workspace details.
  - `PATCH /v1/workspaces/{workspace_id}` – update name/settings.
  - `GET /v1/workspaces/{workspace_id}/members` – list members + roles.
  - `POST /v1/workspaces/{workspace_id}/members` – invite/add member.
- Documents & blocks
  - `GET /v1/workspaces/{workspace_id}/documents` – list docs.
  - `POST /v1/workspaces/{workspace_id}/documents` – create doc (with optional deterministic ID).
  - `GET /v1/documents/{document_id}` – fetch doc metadata + snapshot (or minimal view).
  - `PATCH /v1/documents/{document_id}` – update title/metadata.
  - `DELETE /v1/documents/{document_id}` – soft delete.
  - `GET /v1/documents/{document_id}/blocks` – list root blocks.
  - `PATCH /v1/documents/{document_id}/blocks` – batch mutate blocks (non‑real‑time path).
- Collaboration
  - `GET /v1/ws` – WebSocket endpoint.
    - Query params: `doc_id`, optional `workspace_id`.
    - Sub‑protocol: `caffeine-collab-v1`.
  - WS messages:
    - `ClientMessage::Ops`, `ClientMessage::Presence`, `ServerMessage::Ack`, `ServerMessage::Ops`, `ServerMessage::Presence`.
- Search
  - `GET /v1/workspaces/{workspace_id}/search`
    - Query: `q`, `limit`, `cursor`, `filter` params.
    - Returns doc hits + snippet metadata.
- Headless/GraphQL
  - `POST /v1/graphql`
    - Only queries; mutations rejected with error in v1.
- Files (later phase)
  - `POST /v1/files` – upload attachment (presigned URL or direct).
  - `GET /v1/files/{file_id}` – download (with permission checks).

---

## 10. Observability & Operations

- Metrics:
  - Prometheus (HTTP + gRPC metrics, DB pool metrics, queue metrics).
- Tracing:
  - OpenTelemetry traces spanning gateway/core/workers.
  - Correlation IDs stored in logs and propagated via headers.
- Logging:
  - Structured JSON logs (pino‑style) by default.
  - Log levels: trace/debug/info/warn/error.
- Admin UI:
  - Web UI for:
    - Workspace and user management.
    - Audit logs.
    - AI and plugin configuration.
    - System health (metrics dashboards).

---

## 11. Migration & Interop

### 11.1 AFFiNE Interop

- Goals:
  - Import from an existing AFFiNE instance without data loss.
  - Support ongoing sync or at least one‑shot migrations for early adopters.
- Mechanism:
  - Use only **publicly observable** behavior and formats.
  - Expose tools/CLI commands to:
    - Connect to an AFFiNE instance.
    - Export workspaces as `.caffeine` bundles or equivalent.

### 11.2 Portable `.caffeine` Format

- Format:
  - `.caffeine` = ZIP archive.
  - Contains:
    - SQLite database with normalized workspace data.
    - Assets/attachments.
    - Manifest (JSON or TOML) with schema versions, metadata, and migration hints.
  - Human‑readable fallback via optional Markdown folder export.

### 11.3 Other Tools

- Import/export for:
  - Notion.
  - Obsidian vaults.
  - Markdown folders.
  - Logseq.
  - Standard formats (CSV, OPML, HTML).

Migration is a **first‑class product feature** with in‑app UI, not just CLI.

---

## 12. Plugin Model

### 12.1 Requirements

- Plugins must be:
  - Safe (zero trust by default).
  - Auditable (clear capability manifests).
  - Easy to write (WASM or Deno).

### 12.2 Capabilities & Manifests

- Each plugin defines a **mandatory capability manifest**:
  - Declares:
    - Outbound network access (domains allow‑list).
    - Filesystem access (if any).
    - Database access (scoped to workspace / tables).
    - Custom API endpoints.
    - Auth provider registration.
    - Storage backend registration.
    - Scheduled jobs and event hooks.
- Default: **no capabilities**.
- Instance/workspace admin must explicitly approve each capability at install time.

#### 12.2.1 Manifest Format

- Stored as `plugin.toml` or `plugin.json` inside plugin package and a copy in DB.
- Example (TOML):

```toml
[plugin]
id = "caffeine.example.github-sync"
name = "GitHub Sync"
version = "0.1.0"
description = "Sync issues from GitHub into CAFFeiNE databases."
author = "Example Inc."

[runtime]
kind = "deno"        # or "wasm"
entry = "mod.ts"

[capabilities]
http = { allow = ["https://api.github.com"] }
db = { workspace_scope = true }
scheduled_jobs = [
  { id = "sync_issues", cron = "*/5 * * * *" }
]
webhooks = [
  "document.created",
  "document.updated"
]
custom_api = [
  { path = "/github/sync-now", method = "POST", auth = "workspace-admin" }
]
```

- DB tables:
  - `plugins`
    - `id uuid primary key`
    - `plugin_id text not null` // logical ID ("caffeine.example.github-sync")
    - `version text not null`
    - `manifest jsonb not null`
    - `runtime_kind text not null` // "deno" | "wasm"
    - `enabled boolean not null default false`
    - `created_at timestamptz not null default now()`
    - `updated_at timestamptz not null default now()`
  - `workspace_plugins`
    - `workspace_id uuid references workspaces(id) on delete cascade`
    - `plugin_id uuid references plugins(id) on delete cascade`
    - `approved_capabilities jsonb not null` // subset of manifest.capabilities
    - `config jsonb` // plugin‑specific config, encrypted if needed
    - `created_at timestamptz not null default now()`
    - `updated_at timestamptz not null default now()`
    - `primary key (workspace_id, plugin_id)`

### 12.3 Runtime

- WASM and Deno sandboxes:
  - Standard host APIs:
    - HTTP client (with domain allow‑list).
    - Logging.
    - Key‑value storage (scoped).
    - Limited DB queries via `core` APIs.
  - No direct access to internal Rust types; only via host RPC.

#### 12.3.1 Host APIs (Conceptual)

- For Deno/WASM, we expose a small RPC surface, e.g.:

```ts
// Pseudo TypeScript interfaces exposed to plugins
declare const caff: {
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, fields?: Record<string, unknown>): void;

  httpRequest(req: { method: string; url: string; headers?: Record<string, string>; body?: string | Uint8Array; timeoutMs?: number }): Promise<{ status: number; headers: Record<string, string>; body: Uint8Array }>;

  getDocument(workspaceId: string, documentId: string): Promise<Document>;
  updateDocument(workspaceId: string, documentId: string, patch: Partial<Document>): Promise<Document>;

  enqueueJob(queue: string, payload: unknown, runAt?: string): Promise<void>;
};
```

- All host calls are checked against the approved capabilities for the plugin and workspace.

#### 12.3.2 Lifecycle

- Install:
  - Admin uploads plugin bundle or points to registry URL.
  - `gateway` parses manifest and stores `plugins` row.
  - Admin reviews requested capabilities and approves a subset per workspace.
- Startup:
  - `workers` loads enabled plugins, validates manifests, registers hooks.
- Event handling:
  - On event (e.g., `document.created`), `workers` enqueues a job for each subscribed plugin with necessary payload.
  - Plugin runtime executes handler, may call host APIs.
- Failures:
  - Plugin panics or exceeds resource limits → host marks job as failed and logs error.
  - Repeated failures can auto‑disable plugin per workspace (policy to be defined).

---

## 13. Rust Module Structure (Draft)

High‑level crate layout (subject to refinement):

- `crates/gateway`
  - HTTP/REST/GraphQL/WebSocket.
  - Rate limiting, auth middleware.
  - gRPC client for `core`.
- `crates/core`
  - Domain models (users, workspaces, documents, blocks, ACLs, sessions, plugins).
  - Persistence adapters (Postgres, SQLite).
  - Collab engine (OT/CRDT).
  - Search integration.
  - Import/export.
  - AI orchestration.
- `crates/workers`
  - Job queue client.
  - Webhook executor.
  - Automation runtime integration (Deno).
  - AI job workers.
  - Schedulers.
- `crates/proto`
  - gRPC service definitions.
- `crates/shared`
  - Shared utilities (ID generation, base58, config, logging, tracing).

Implementation detail:

- Each binary crate (`gateway`, `core`, `workers`) exposes:
  - `main.rs` with small bootstrap only (config load + run).
  - `lib.rs` for actual application logic (to enable re‑use in tests).
- Domain modules in `core`:
  - `domain::user`, `domain::workspace`, `domain::document`, `domain::block`, `domain::auth`, `domain::search`, `domain::ai`, `domain::plugin`.
  - `application::services::*` orchestrate domain logic + persistence.
  - `infra::db`, `infra::search`, `infra::queue` provide adapters.

---

## 14. Draft Function & Service Interfaces (Illustrative)

### 14.1 Core gRPC Service (Sketch)

```rust
// crates/proto/src/core.proto (conceptual)
service CoreService {
  rpc CreateWorkspace(CreateWorkspaceRequest) returns (WorkspaceResponse);
  rpc GetWorkspace(GetWorkspaceRequest) returns (WorkspaceResponse);

  rpc CreateDocument(CreateDocumentRequest) returns (DocumentResponse);
  rpc GetDocument(GetDocumentRequest) returns (DocumentResponse);
  rpc ListDocuments(ListDocumentsRequest) returns (ListDocumentsResponse);

  rpc ApplyOps(ApplyOpsRequest) returns (ApplyOpsResponse); // OT/CRDT ops
  rpc GetSnapshot(GetSnapshotRequest) returns (GetSnapshotResponse);

  rpc Search(SearchRequest) returns (SearchResponse);

  rpc GetUser(GetUserRequest) returns (UserResponse);
  rpc ResolveSession(ResolveSessionRequest) returns (ResolveSessionResponse);

  rpc EnqueueJob(EnqueueJobRequest) returns (EnqueueJobResponse);
}
```

### 14.2 ID Generation Utility

```rust
// crates/shared/src/id.rs
pub fn generate_deterministic_id(block: &NormalizedBlock) -> String {
    let canonical = canonical_json(block);
    let mut hasher = blake3::Hasher::new();
    hasher.update(canonical.as_bytes());
    let hash = hasher.finalize();
    base58::encode(hash.as_bytes())
}
```

### 14.3 Collab Flow – Pseudocode

```rust
// gateway: WebSocket handler
on_ws_message(msg) {
  match msg {
    ClientMessage::Ops { doc_id, ops, client_vclock } => {
      let user = auth::require_user(&ctx)?;
      let req = ApplyOpsRequest { doc_id, ops, client_vclock, user_id: user.id };
      let res = core_client.apply_ops(req).await?;
      ws.send(ServerMessage::Ack { doc_id, server_vclock: res.server_vclock });
      for follower in subscribers(doc_id) {
        follower.send(ServerMessage::Ops { doc_id, ops: res.applied_ops.clone() });
      }
    }
    ClientMessage::Presence { doc_id, presence } => {
      presence_manager.update(user_id, doc_id, presence);
      broadcast_presence(doc_id);
    }
  }
}
```

---

## 15. Implementation Checklist (Phased)

### Phase 0 – Groundwork (1–2 days)

**Goal:** scaffold Rust workspace, core crates, and tooling so all later work is mechanical.

- [ ] Clean‑room and contracts
  - [ ] Lock in clean‑room docs (`dev/cleanroom/CLEANROOM.md`), add `DERIVATION_LOG.md` stub.
  - [ ] Decide which AFFiNE‑observed behaviors (if any) are in scope for v0 and document them.
- [ ] Rust workspace setup
  - [ ] Update root `Cargo.toml` to a workspace with members:
        `crates/gateway`, `crates/core`, `crates/workers`, `crates/shared`, `crates/proto`.
  - [ ] Create crates: - `cargo new --bin crates/gateway` - `cargo new --bin crates/core` - `cargo new --bin crates/workers` - `cargo new --lib crates/shared` - `cargo new --lib crates/proto`
  - [ ] In each binary crate, move logic to `lib.rs` and keep `main.rs` as thin bootstrap.
- [ ] Base dependencies and infra
  - [ ] Choose HTTP framework (axum) and add to `gateway`.
  - [ ] Add `tonic` + `prost` to `core`/`proto`/`gateway`.
  - [ ] Add `sqlx` (with Postgres + SQLite features) to `core`.
  - [ ] Add tracing stack (`tracing`, `tracing-subscriber`, `opentelemetry`, `opentelemetry-otlp`) to shared.
  - [ ] Add config crate (e.g., `config` or `figment`) to `shared` and wire `AppConfig`.
- [ ] Dev tooling
  - [ ] Add `cargo fmt` and `cargo clippy` to existing CI.
  - [ ] Add `sqlx` offline mode setup if using it (env + build script).
  - [ ] Add `justfile` or `Makefile` with common commands:
        `just dev-gateway`, `just dev-core`, `just dev-workers`, `just db-migrate`.

**Exit criteria:** `cargo check` passes for all crates; `caffeine-gateway --help` et al. run and read config.

### Phase 1 – Core Storage & Auth (3–5 days)

**Goal:** have `core` able to create users, workspaces, and documents, with auth/session primitives.

- [ ] DB migrations
  - [ ] Create migration framework (e.g., `sqlx::migrate!` or `refinery`) in `crates/core`.
  - [ ] Implement initial migrations for:
    - [ ] `users`, `user_auth_local`, `user_auth_oauth`.
    - [ ] `workspaces`, `workspace_memberships`.
    - [ ] `documents`, `blocks`.
    - [ ] `sessions`, `api_tokens`.
    - [ ] `audit_log`, `jobs`, `ai_workspaces_config`, `plugins`, `workspace_plugins`, `embeddings`.
  - [ ] Add `caffeine-core migrate` CLI subcommand to run migrations against `CAFF_DB_URL`.
- [ ] DB access layer
  - [ ] Implement `infra::db::DbPool` and `DbTxn` wrapper types.
  - [ ] Implement repository traits:
    - `UserRepo`, `WorkspaceRepo`, `DocumentRepo`, `BlockRepo`, `SessionRepo`, `TokenRepo`, `AuditRepo`.
  - [ ] Provide Postgres implementations (SQLite can come later).
- [ ] ID generation
  - [ ] Implement `crates/shared::id`:
    - `generate_deterministic_id(NormalizedBlock)`.
    - `new_uuid7()` helper.
  - [ ] Unit tests to confirm deterministic IDs across platforms (Rust + TS fixtures).
- [ ] Auth primitives (core only, no HTTP)
  - [ ] Implement `domain::auth::PasswordHasher` wrapper around argon2id.
  - [ ] Implement `AuthService` in `application::services::auth`:
    - `register_local(email, password, name)`.
    - `login_local(email, password)`.
    - `create_session(user_id, ip, user_agent)`.
    - `validate_session(session_id)` returning user + memberships.
  - [ ] Implement workspace membership & RBAC helpers:
    - `fn require_permission(user_id, workspace_id, action) -> Result<()>`.
    - `fn list_user_workspaces(user_id) -> Vec<WorkspaceWithRole>`.

**Exit criteria:** integration test can call `core` APIs (direct Rust) to register a user, create a workspace, and create a document + blocks in Postgres.

### Phase 2 – Gateway & Basic APIs (3–5 days)

**Goal:** expose HTTP APIs for auth, workspaces, and basic documents; wire gateway ↔ core over gRPC.

- [ ] Core gRPC surface (minimal)
  - [ ] Define `CoreService` proto with methods:
        `CreateUser`, `CreateWorkspace`, `ListWorkspacesForUser`,
        `CreateDocument`, `GetDocument`, `ListDocuments`.
  - [ ] Generate Rust stubs with `tonic-build` into `crates/proto`.
  - [ ] Implement gRPC server in `core`:
    - Map each call to the relevant service (`AuthService`, `WorkspaceService`, etc.).
- [ ] Gateway HTTP skeleton
  - [ ] Set up axum router with middlewares:
    - Request ID + tracing span.
    - JSON body limit; error handling.
  - [ ] Implement health endpoints `/v1/health`, `/v1/version`.
- [ ] Auth HTTP endpoints
  - [ ] Map `/v1/auth/register` → `CoreService::CreateUser`.
  - [ ] Map `/v1/auth/login` → `AuthService::login_local` via gRPC.
  - [ ] Implement cookie handling for `caff_session`.
  - [ ] Implement `/v1/auth/me` calling `ResolveSession`.
- [ ] Workspace & document endpoints
  - [ ] Implement `/v1/workspaces` list/create using gRPC.
  - [ ] Implement `/v1/workspaces/{id}` get/patch.
  - [ ] Implement basic document CRUD as outlined in 9.5.
- [ ] OpenAPI + TS client
  - [ ] Annotate handlers with OpenAPI metadata (via `utoipa` or similar).
  - [ ] Generate `openapi.json` artefact in CI.
  - [ ] Generate basic TypeScript client types for CAFFEiNE frontend usage.

**Exit criteria:** local dev can register/login, create workspace, create document via HTTP; basic OpenAPI spec generated.

### Phase 3 – Collaboration Engine (5–7 days)

**Goal:** real‑time editing for a single document with basic OT and presence.

- [ ] Domain model
  - [ ] Define `OtOp`, `DocVersion`, `VectorClock` types in `domain::collab`.
  - [ ] Create `document_ops` table (if needed) for event log: `(id, document_id, seq, op, author, vclock, created_at)`.
- [ ] Core engine
  - [ ] Implement `CollabService`:
    - `apply_ops(document_id, user_id, ops, client_clock)` → `ApplyOpsResponse`.
    - `get_snapshot(document_id)` → `Snapshot`.
  - [ ] For v0, implement a simple OT or CRDT with strong tests and assume “small doc” scale; optimize later.
- [ ] gRPC methods
  - [ ] Add `ApplyOps` and `GetSnapshot` to `CoreService`.
  - [ ] Ensure idempotency on re‑sent ops via vector clocks / sequence numbers.
- [ ] Gateway WebSocket
  - [ ] Implement `/v1/ws` handler using axum WebSocket upgrade.
  - [ ] Session auth handshake: validate `caff_session` before joining.
  - [ ] Routing:
    - Map each WS connection to `(workspace_id, doc_id, user_id)`.
    - Maintain in‑memory hub (per node) with broadcast channels.
  - [ ] Message schema:
    - Define `ClientMessage` and `ServerMessage` enums (JSON or binary).
  - [ ] Presence manager:
    - Track presence in memory per doc; periodically sync to `core` if desired.
- [ ] Testing
  - [ ] Add property/Fuzz tests for `CollabService` merges.
  - [ ] Add integration test: two clients editing same doc concurrently via WS.

**Exit criteria:** two browser tabs can edit the same document via gateway+core, and both see live updates and presence.

### Phase 4 – Search & E2E Modes (4–6 days)

**Goal:** workspace‑scoped full‑text search and E2E mode toggles wired into persistence and APIs.

- [ ] Meilisearch integration
  - [ ] Add search client to `infra::search` in `core`.
  - [ ] Implement functions:
    - `index_document(SearchDoc)` → result.
    - `delete_document(doc_id)` / `delete_workspace_docs(workspace_id)`.
    - `search_documents(workspace_id, SearchQuery)` → `SearchResult`.
  - [ ] Wire `SearchService` into `CoreService::Search`.
- [ ] Indexing pipeline
  - [ ] Implement `SearchDoc` builder in `DocumentService` that flattens blocks/text.
  - [ ] On doc or block change, enqueue `jobs` row to `search-index`.
  - [ ] Implement `workers` handler for queue `search-index` to call Meilisearch.
- [ ] E2E workspace mode
  - [ ] Add toggling of `workspaces.e2ee_enabled`.
  - [ ] Ensure E2E docs store only ciphertext content + token arrays (design to refine).
  - [ ] Implement E2E search path:
    - Search endpoint accepts `tokens[]` and bypasses plaintext `q`.
    - Workers index `tokens` field only.
- [ ] Search HTTP/GraphQL
  - [ ] Implement `/v1/workspaces/{workspace_id}/search` as per 7.4.
  - [ ] Implement GraphQL `searchDocuments` resolver calling `SearchService`.

**Exit criteria:** plaintext workspaces can search across docs; E2E workspaces can search via tokens; tests cover permission filtering and index lifecycle.

### Phase 5 – AI & Automation (5–8 days)

**Goal:** basic AI endpoints and job‑driven embeddings; webhooks and automation runtime stubs.

- [ ] AI provider abstraction
  - [ ] Implement `AiProviderRegistry` in `core`.
  - [ ] Add at least one provider implementation (e.g., OpenAI) reading from `AiWorkspaceConfig`.
- [ ] AI endpoints
  - [ ] Wire `/v1/ai/chat`, `/v1/ai/embed`, `/v1/ai/summarize`, `/v1/ai/assist-edit` in `gateway`.
  - [ ] Enforce workspace config and consent toggles.
  - [ ] Implement rate limiting specific to AI routes.
- [ ] Embedding pipeline
  - [ ] On doc changes, enqueue `jobs` row in queue `ai-embed`.
  - [ ] Implement `workers` handler to call `AiProvider::embed` and write `embeddings`.
  - [ ] Optionally integrate vector index (e.g., pgvector) for semantic search.
- [ ] Webhooks framework
  - [ ] Implement `webhooks` table or reuse `jobs` with queue `webhook`.
  - [ ] Implement signing (HMAC) and retry backoff.
  - [ ] Add minimal configuration per workspace (URL + secret + subscribed events).
- [ ] Automation runtime
  - [ ] Implement minimal Deno runner with resource limits.
  - [ ] Parse plugin manifests and wire capability checks.
  - [ ] Support scheduled jobs and event hooks via `jobs` table.

**Exit criteria:** workspace can configure AI provider, call `/v1/ai/*`, get embeddings stored, and run a simple automation job on `document.created`.

### Phase 6 – Headless APIs & GraphQL (4–6 days)

**Goal:** stable headless read surface (REST + GraphQL) for external integrations.

- [ ] Object types
  - [ ] Add DB tables for object types and fields (if not already):
    - `object_types`, `object_fields`, `object_records`.
  - [ ] Implement REST CRUD for object types and records.
- [ ] GraphQL schema
  - [ ] Pick GraphQL crate (e.g., `async-graphql`).
  - [ ] Define schema types: `Workspace`, `Document`, `Block`, `Database`, `Record`, `SearchHit`.
  - [ ] Implement resolvers using `core` gRPC client.
  - [ ] Ensure permission checks in resolvers or underlying `core` calls.
- [ ] Filters and relations
  - [ ] Implement simple filter language (e.g., eq, lt, gt, in) for object records.
  - [ ] Implement relation fetching between docs and object records.

**Exit criteria:** third‑party app can query workspace content and database rows via GraphQL and REST without custom code.

### Phase 7 – Migration & Import/Export (5–8 days)

**Goal:** portable `.caffeine` exports and imports from major sources.

- [ ] `.caffeine` format
  - [ ] Define manifest schema (`manifest.json`/TOML).
  - [ ] Define minimal SQLite schema for bundled exports.
  - [ ] Implement `caffeine-core export-workspace` CLI:
    - Dumps workspace data + assets into a `.caffeine` ZIP.
  - [ ] Implement `caffeine-core import-workspace` CLI:
    - Imports from `.caffeine` into a running Postgres instance.
- [ ] Importers (phase scoped to v1 targets)
  - [ ] Markdown folder / Obsidian:
    - Parse folder tree into docs + blocks.
  - [ ] Logseq:
    - Parse pages/outlines to block tree.
  - [ ] Notion (if feasible via public API/exports) – design adapter.
- [ ] AFFiNE migration tooling
  - [ ] Based solely on publicly observable behavior and/or exports.
  - [ ] Document derivations in `dev/cleanroom/DERIVATION_LOG.md`.

**Exit criteria:** CLI can export/import workspaces, and at least one external source (Markdown/Obsidian) can be imported with good fidelity.

### Phase 8 – Polishing & Ops (ongoing)

**Goal:** production‑ready self‑hosted story and UX polish.

- [ ] Rate limiting & security hardening
  - [ ] Tune leaky/token bucket parameters.
  - [ ] Add IP blocking/backoff for abusive clients.
  - [ ] Double‑check TLS, headers, and CSRF story.
- [ ] Admin UI
  - [ ] Implement web UI for:
    - Workspace/user management.
    - AI configuration.
    - Plugin management and capability approvals.
    - Basic metrics overview (requests, errors, queue depth).
- [ ] Observability
  - [ ] Ship example Prometheus + Grafana dashboards.
  - [ ] Add standard tracing spans and attributes for key operations.
- [ ] Distribution
  - [ ] Create Dockerfiles for `gateway`, `core`, `workers`.
  - [ ] Create `docker-compose.yml` for local/self‑host.
  - [ ] Document bare‑metal + systemd setup.
  - [ ] Provide templated configs for popular hosting services (e.g., Hetzner)

**Exit criteria:** one‑line `docker compose up` or simple binary install yields a usable CAFFeiNE backend with docs for operators.

---

## 16. Clean‑Room Constraints (Summary)

- Never copy or re‑use AFFiNE server code or internal algorithms.
- Only rely on:
  - Public documentation.
  - On‑the‑wire behavior observed from clients.
  - Independent design described here.
- Maintain `dev/cleanroom` artifacts:
  - `CLEANROOM.md` describing roles, rules, and process.
  - Logs of what was inferred from public behavior vs independently designed.
