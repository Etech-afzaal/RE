# Dhalahore Properties

Real-estate marketplace for Lahore: public property listings, agent estates, and admin/agent dashboards. Built with **Next.js 14** (App Router), **React**, and **MySQL** (plain JavaScript — no TypeScript).

Path alias `@/` is configured in `jsconfig.json`.

---

## Features

- **Homepage** — hero slider, Sale / Rent / Plots sections, locations, contact
- **Public estate pages** — `/re/{estate_name}` and `/re/{estate_name}/{propertyId}`
- **Agent signup** — `/agent/signup` → `signup_requests` + email to admin
- **Admin approval** — `/admin/dashboard/requests` → creates agent account + email
- **Agent login** — `/agent/login` (NextAuth credentials)
- **Admin login** — `/admin/login` (env-based admin account)
- **Agent dashboard** — add/edit properties, upload images (watermarked with `sharp`)
- **Password reset** — agents with `must_reset_password` are redirected to `/agent/reset-password`

---

## Requirements

Install these on the machine before setup:

| Tool | Notes |
|------|--------|
| **Node.js** | 18+ recommended (LTS) |
| **npm** | Comes with Node |
| **MySQL** | 8.0+ (local or remote). Client optional — seeding works via `npm run seed` |

---

## Setup on a new machine

### 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd RE
npm install
```

### 2. Configure environment

```bash
cp example.env .env
```

Edit `.env` and set real values:

```env
# MySQL — must match a running MySQL server
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=real_estate

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=           # generate: openssl rand -base64 32

# Hardcoded admin account (not stored in MySQL)
ADMIN_PASSWORD=change_this_password
ADMIN_EMAIL=you@example.com

# SMTP (signup / approval emails). Optional for local UI testing.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM="Dhalahore Properties <your_email@gmail.com>"

# Public site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Notes:

- Use `.env` (not `.env.local`) — this project reads `DB_*` from `.env`.
- Never commit `.env` (it is gitignored).
- If MySQL runs on another PC/VM, set `DB_HOST` to that IP and allow remote connections.

### 3. Create the database schema

With the MySQL CLI:

```bash
mysql -u root -p < schema.sql
```

Or from any MySQL client, run the contents of `schema.sql`.

This creates the `real_estate` database and tables:

- `signup_requests`
- `agents`
- `properties`
- `property_images`

### 4. Load demo data (recommended)

```bash
npm run seed
```

This runs `seed.sql` using credentials from `.env`. It:

- Clears listing tables and inserts realistic Lahore demo data
- Creates **8 agents**, **19 properties** (sale / rent / plots), and demo images
- Expects image files under `public/uploads/demo/` (already in the repo)

**Demo agent password (all seeded agents):** `demo1234`

Examples:

| Email | Estate URL |
|-------|------------|
| `bilal@dhahomes.pk` | `/re/dha-homes` |
| `sara@bahriaestate.pk` | `/re/bahria-estate` |
| `usman@gulbergprops.pk` | `/re/gulberg-props` |

Re-running `npm run seed` **wipes** agents/properties/images and reloads the demo set.

Without the MySQL CLI, `npm run seed` is enough after schema exists (it uses Node + `mysql2`).

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Role | URL | Credentials |
|------|-----|-------------|
| Public site | `/` | — |
| Admin | `/admin/login` | `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` |
| Agent | `/agent/login` | seeded email + `demo1234` |

---

## Useful scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npm run seed` | Reset + load demo data from `seed.sql` |

---

## Project structure (high level)

```
app/
  page.js                 # Homepage
  (public)/re/...         # Public estate + property pages
  (admin)/agent/...       # Agent signup, login, dashboard, properties
  (admin)/admin/...       # Admin login + request approval
  api/...                 # API routes
components/               # HeroSlider, HomeListings, SiteHeader, etc.
lib/
  db.js                   # MySQL pool
  queries.js              # Shared DB queries
  auth.js                 # NextAuth config
public/
  uploads/demo/           # Seed / demo property images
  uploads/{id}/           # Live uploads per property
  hero/                   # Fallback / marketing hero images
schema.sql                # Tables only
seed.sql                  # Demo agents + properties + images
scripts/seed.js           # npm run seed entrypoint
example.env               # Env template
```

---

## Images

| Path | Use |
|------|-----|
| `public/uploads/demo/` | Demo seed images referenced in `seed.sql` (e.g. `sale-1.jpg`, `rent-1.jpeg`) |
| `public/uploads/{propertyId}/` | Images uploaded by agents (watermarked) |
| `public/hero/` | High-res hero fallbacks |

Sale / Rent / Plots on the homepage are inferred from the property **title/description** (`rent` / `plot` keywords; otherwise sale). There is no separate DB category column yet.

To refresh demo photos: replace files under `public/uploads/demo/` **keeping the same filenames**, then hard-refresh the browser (no seed required unless you change paths in `seed.sql`).

---

## Production notes

```bash
npm run build
npm run start
```

Before production:

1. Set strong `NEXTAUTH_SECRET` and admin password.
2. Point `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` at your real domain.
3. Use a dedicated MySQL user (not root) with a strong password.
4. Configure working SMTP so agent approval emails send.
5. Consider moving uploads from local disk to S3/R2/Spaces (watermark logic can stay the same).

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| DB connection errors | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `.env`; MySQL running; firewall/remote access if host is not localhost |
| Empty homepage listings | Run `schema.sql`, then `npm run seed`; ensure `public/uploads/demo/` images exist |
| Broken images | Paths in DB must match files under `public/` (e.g. `/uploads/demo/sale-1.jpg` → `public/uploads/demo/sale-1.jpg`) |
| Admin login fails | Use `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (not agent emails) |
| Agent login fails | Use seeded email + `demo1234`, or reset via approval flow |
| Emails not sending | SMTP vars; for Gmail use an [App Password](https://support.google.com/accounts/answer/185833) |

---

## License

Private / project use unless otherwise specified.
