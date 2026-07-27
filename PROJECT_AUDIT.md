# PROJECT_AUDIT.md

Phase 0 — Existing Codebase Audit & Preparation  
Phase 1 — Database Foundation Update  
Phase 2 — Role & Authentication Enhancement  
Phase 3 — Convert Homepage Into Agent Public Website  
Phase 4 — Create New Customer Homepage  
Project: DhaLahore.com / Dhalahore Properties  
Last updated: 2026-07-26

---

## Current Tech Stack

- **Frontend:** Next.js 14.2.5 (App Router), React 18, plain JavaScript, CSS Modules
- **Backend:** Next.js Route Handlers under `app/api/**`
- **Database:** MySQL 8 via `mysql2` (`lib/db.js`); `schema.sql` + `migrations/` + `seed.sql`
- **Authentication:** NextAuth.js v4 (Credentials, JWT)
- **Storage:** Local `public/uploads/{propertyId}/` (watermarked with `sharp`)
- **Email:** Nodemailer (`lib/mail.js`)
- **Deployment:** Standard `next build` / `next start` (uploads need object storage for ephemeral hosts)

---

## Existing Folder Structure

| Path | Purpose |
|------|---------|
| `app/` | Pages + API routes; groups `(public)` / `(admin)` do not change URLs |
| `components/` | Shared UI (homepage, admin shell) |
| `lib/` | db, queries, auth, adminAuth (authz), roles, status, mail, generate |
| `public/` | Static assets and uploads |
| `migrations/` | Versioned SQL migrations (Phase 1+) |
| `scripts/` | `seed.js`, `migrate-phase1.js` |
| `schema.sql` | Canonical DDL for fresh installs |
| `seed.sql` | Demo data |
| `middleware.js` | NextAuth protection + role redirects |

---

## Current Homepage Flow

- **URL:** `/` — `app/page.js` (server component, `revalidate = 60`)
- **Data:** `getFeaturedProperties`, `getHeroSlides`, `getPublicStats`, `getPopularLocations` from `lib/queries.js` (direct DB)
- **Public listings** use property status **`approved`** (Phase 1; formerly `active`)
- **Components:** SiteHeader, HeroSlider, AboutDHALahore, HomeListings, TrustStats, LocationCarousel

---

## Current Property Architecture

- Estate page: `/re/[estate_name]`
- Detail page: `/re/[estate_name]/[propertyId]`
- Ownership: `properties.agent_id` → `agents.id`
- Images: `property_images` under `public/uploads/...`
- Create flow still defaults to **`approved`** (live) until a later approval UI phase

---

## Current Admin Dashboard

- `/admin/dashboard` (+ requests, agents, properties)
- Auth: env `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- APIs map DB `approved` ↔ UI legacy `active` so existing screens keep working without redesign

---

## Current Authentication System

- Roles: `admin` (env), `agent` (DB)
- Live agents: `agents.status = 'approved'`
- JWT session; middleware protects admin/agent routes

---

## Current Database Structure

### `signup_requests`

Agent applications (`pending` / `approved` / `rejected` / `revoked`).

### `agents`

Login-capable estates. Phase 1 fields: `username`, `profile_image`, `description`, `areas_served`, `updated_at`.  
Status: `pending` | `approved` | `rejected` | `disabled`.

### `properties`

Belongs to agent (`agent_id`).  
Status: `draft` | `pending_approval` | `approved` | `rejected` | `sold` | `hidden`.  
Approval fields: `approved_by`, `approved_at`, `rejected_reason`.

### `property_images`

`property_id`, `image_url`, `image_title`, `is_featured`, `sort_order`, `created_at`, `updated_at`.

### `schema_migrations`

Tracks applied migration IDs.

---

## Phase 1 Database Changes

### Goal

Prepare the schema for multi-agent approval workflow **without** changing UI, routes, or public behavior.

### Migration files created

| File | Purpose |
|------|---------|
| `migrations/001_phase1_foundation_up.sql` | Reference UP SQL |
| `migrations/001_phase1_foundation_down.sql` | Reference DOWN SQL |
| `scripts/migrate-phase1.js` | Idempotent runner (preferred) |
| `npm run migrate:phase1` | Apply |
| `npm run migrate:phase1 -- --down` | Rollback |

### Tables changed

| Table | Change |
|-------|--------|
| `agents` | New columns + status enum remap |
| `properties` | Approval columns + status enum remap |
| `property_images` | Added `updated_at` |
| `schema_migrations` | Created |

### Columns added

**agents**

- `username` (UNIQUE, backfilled from `estate_name`)
- `profile_image`
- `description`
- `areas_served`
- `updated_at`

**properties**

- `approved_by`
- `approved_at`
- `rejected_reason`

**property_images**

- `updated_at`

### Data migration performed

| From | To |
|------|-----|
| `agents.status = active` | `approved` |
| `agents.status = disabled` | `disabled` (unchanged) |
| `properties.status = active` | `approved` |
| `properties.status = draft` | `draft` |
| `properties.status = sold` | `sold` |

Migrated approved properties also set:

- `approved_by = 'legacy_migration'`
- `approved_at = created_at`

**Ownership:** `agent_id` already present; unchanged.

### Existing data handling

- No rows deleted
- All existing agents, properties, and images preserved
- Fresh installs use updated `schema.sql` / `seed.sql` (`approved` + `username`)

### Backend helpers (required for app continuity)

- `lib/status.js` — status constants + `active` ↔ `approved` mapping for admin UI
- `lib/queries.js`, `lib/auth.js`, contact + admin APIs, agent grant/approve — filter/write **`approved`** as live status

### Future workflow support (not implemented in UI yet)

```
draft → pending_approval → approved | rejected
                         → sold | hidden
```

Admin can already PATCH new property statuses via API; UI still sends legacy `active` / `draft` / `sold`.

### Application impact (Phase 1)

- No new pages or routes
- No UI redesign
- Homepage / estate / admin continue to treat live listings as before (via `approved` + client mapping)

---

## Phase 2 Authentication Changes

### Pre-Phase-2 audit (limitations addressed)

| Area | Before |
|------|--------|
| Provider | NextAuth Credentials + JWT |
| Roles | Informal strings `admin` / `agent` |
| Admin identity | Env `ADMIN_EMAIL` / `ADMIN_PASSWORD` (no users table) |
| Agent identity | `agents` table |
| Session | `id`, `role`, `estate_name`, `mustResetPassword`, `isActive` — missing `username`, `agent_id`, `status`, admin `email` |
| Status login | Only “not active”; Phase 1 statuses (`pending`/`rejected`/`disabled`) already blocked via `isAgentLive` |
| Authz helpers | Only `requireAdmin()` checking `role === "admin"` |
| Middleware | Protected `/admin/dashboard` + `/agent/*`; no future path prep |

### Role system implemented

Canonical roles (JWT/session):

- `SUPER_ADMIN` — platform admin (env credentials; login form still sends hint `role: "admin"`)
- `AGENT` — approved estate agent (login form still sends hint `role: "agent"`)

Legacy normalization: `admin` → `SUPER_ADMIN`, `agent` → `AGENT` (old JWTs keep working until re-login).

Customers remain unauthenticated public users.

### Session shape

**SUPER_ADMIN:** `id`, `email`, `role`  
**AGENT:** `id`, `email`, `role`, `username`, `agent_id`, `status`, plus existing `estate_name` / `mustResetPassword` / `isActive` for current pages  

Sensitive fields (password hashes) are never placed on the session. Agent `status` / `isActive` are refreshed from DB on JWT callback.

### Route protection

| Who | Existing (preserved) | Future matcher (pages not built yet) |
|-----|----------------------|--------------------------------------|
| SUPER_ADMIN | `/admin/dashboard/*` | `/admin_dashboard/*` |
| AGENT | `/agent/dashboard`, `/agent/properties/*`, `/agent/reset-password` | `/re/[username]/adminarea/*` (username must match token) |
| Public | `/`, `/re/[slug]`, `/re/[slug]/[id]`, login/signup | — |

Agents are redirected away from admin routes; SUPER_ADMIN is redirected away from agent-only routes. Authorization is server-side (middleware + `lib/adminAuth.js`); client role values are not trusted for API access.

### Authz helpers (`lib/adminAuth.js`)

- `getCurrentUser()`
- `requireAdmin()` — SUPER_ADMIN
- `requireAgent()` — AGENT + live account
- `requireRole(role)`

Used by admin + property + agent APIs; foundation for later phases.

### Agent status login rules

| Status | Login |
|--------|-------|
| `pending` | Denied |
| `approved` | Allowed |
| `rejected` | Denied |
| `disabled` | Denied |

### Files touched (auth foundation)

- `lib/roles.js` (new)
- `lib/auth.js`, `lib/adminAuth.js`, `middleware.js`
- Admin layout role check; agent dashboard role check
- APIs switched to `requireAdmin` / `requireAgent` where they previously compared raw role strings

### Unchanged by design

- Admin dashboard UI/components/functionality
- Login page UI (still posts `role: "admin"` / `role: "agent"` hints)
- No agent portal, approval UI, or homepage changes

---

## Phase 3 — Agent Public Website

### Goal

Reuse the **exact homepage design** as each agent’s public property site at `/re/[agent_username]`. Root `/` stays the marketplace temporarily.

### Routes

| URL | Behavior |
|-----|----------|
| `/` | Unchanged marketplace homepage (all approved listings) |
| `/re/[agent_username]` | Same UI as homepage; data scoped to that agent |
| `/re/[agent_username]/[property_slug]` | Existing property detail UI; slug = `{title}-{id}` (numeric id still works) |

Filesystem still uses `[estate_name]` / `[propertyId]` segment folders (no folder rename); lookup is by **username** (fallback `estate_name`) and **slug/id**.

### Components reused (no redesign)

- `PublicPropertyWebsite` (shared shell extracted from homepage)
- `SiteHeader`, `HeroSlider`, `AboutDHALahore`, `HomeListings`, `TrustStats`, `LocationCarousel`
- Property detail page + `GalleryCarousel` (existing CSS/modules)
- `app/page.module.css` styles unchanged

### Data layer

| Helper | Purpose |
|--------|---------|
| `getAgentByUsername` | Approved agent by username / estate_name |
| `getApprovedPropertiesByAgent` | `status = approved` only |
| `getPropertyByAgentAndSlug` | Ownership + approved check |
| `getHeroSlidesForAgent` / `getPublicStatsForAgent` / `getPopularLocationsForAgent` | Agent-scoped homepage sections |
| `lib/propertySlug.js` | Slug build/parse + public paths |

### Agent info section

Inserted **before** property listings on agent pages only, using existing contact/section class patterns (name, agency, profile image, contact, description, areas served).

### Security

- Non-approved properties never listed or opened publicly
- Cross-agent URL → `404`
- Disabled/pending agents → `404` on public site

---

## Phase 4 — Customer Homepage (Agent Discovery)

### Goal

Root `/` is now a **customer landing page** focused on discovering approved agents. Agent property websites remain at `/re/[username]` (Phase 3 design untouched).

### Sections

1. Hero — “Find Trusted Real Estate Experts in DHA Lahore”
2. Agent search — text + area + city filters
3. Agent cards — profile, agency, areas, approved property count, View Profile → `/re/[username]`
4. Why choose DhaLahore
5. Become an Agent CTA → `/agent/signup`
6. Contact + footer (agent/admin login links)

### Data

| Helper | Purpose |
|--------|---------|
| `getApprovedAgents()` | Approved agents + property counts + listing locations |
| `getApprovedPropertyCount(agentId)` | Single-agent count helper |
| `getAgentDiscoveryAreas()` | Distinct areas for filter dropdown |

### Design

Reuses brand tokens (gold/ink/paper), Manrope/Inter, card/search-bar/CTA/footer patterns from the existing product. New styles live in `components/CustomerHome.module.css` only.

### Unchanged

- `/re/[username]` + property detail UI
- Admin dashboard
- Auth

---

## Future Implementation Notes

- Agent multi-tenancy / public branded sites
- Property approval UI (agent submit + admin review)
- Richer agent portal
- Users table / multi-admin roles
- Object storage for uploads
- Explicit listing category column (replace title keywords)
