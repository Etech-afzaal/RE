# Dhalahore Properties — Starter (JavaScript)

This is the plain-JavaScript version of the project (no TypeScript). Path alias `@/` is configured via `jsconfig.json` instead of `tsconfig.json`.


## What's included so far

- **Public signup** (`/admin/signup`) → saves a `signup_requests` row + emails admin
- **Admin approval** (`/admin/dashboard/requests`) → generates ASN, username, temp password → creates `agents` row → emails agent
- **Login** (`/admin/login`) via NextAuth Credentials (agents + one hardcoded admin via env vars)
- **Add property** (`/admin/properties/new`) → saves property, uploads + watermarks images with `sharp`
- **Public listings** (`/re/{asn}`) → grid of an agent's active properties
- **Public property detail** (`/re/{asn}/{propertyId}`)

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - MySQL credentials
   - `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`)
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` (add these two — used for the hardcoded admin login)
   - SMTP credentials (Gmail app password, SendGrid, Resend SMTP, etc.)
3. Create the database: `mysql -u root -p < schema.sql`
4. `npm run dev`

## What's NOT done yet (next steps)

- Forcing password reset on first agent login (the `must_reset_password` flag exists in the DB and session — you just need a page that checks it and redirects to a "set new password" form)
- Editing/deleting properties (`/admin/properties/[id]/edit`)
- Property search/filter on the public site
- Moving image storage from local disk to S3/R2/Spaces for production (the watermark logic stays identical — only the "where do I write the file" part changes)
- Pagination for agents with many listings
- A real logo image for the watermark instead of text (swap the SVG in `app/api/properties/[id]/images/route.ts` for a composited PNG logo if you'd rather have that)

## Notes on the ASN

The agent's `/re/{asn}` slug is a random 6-character code (e.g. `A7X9K2`), generated in `lib/generate.ts`. If you'd rather have something more readable (e.g. based on the agent's name, like `/re/ali-raza`), that's an easy swap — just change `generateAsn()` to slugify `full_name` and check for collisions the same way.
