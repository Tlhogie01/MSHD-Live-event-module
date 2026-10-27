# MSHD Events

Starter for the MSHD Events Management Module using Next.js, TypeScript, Tailwind CSS and MySQL.

The admin UI uses the MSHD Live public player identity: the MotionSense HD logo, Inter type, deep navy surfaces, white text, and burgundy accent. The logo is stored at `public/mshd-live-logo.png` and was referenced by the official site’s public player bundle.

## Local setup

1. Install Node.js and MySQL on your development computer.
2. Create a local environment file: copy `.env.example` to `.env.local`, then enter your local MySQL credentials.
3. Run `backend/database/schema.sql` in MySQL Workbench or the MySQL CLI for a new database.
   If the database already exists, run each unapplied migration in `backend/database/migrations/` once, in numeric order (`001` through `004`). Migration `003` creates the administrator table and event ownership reference; migration `004` preserves inventory reservations made by checkouts created before confirmed-payment counting was added.
4. Set a random `SESSION_SECRET` of at least 32 characters in your local environment file. For PayFast, set `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_MODE=sandbox`, and `APP_BASE_URL` to the public HTTPS URL that PayFast can reach. Keep real credentials private.
5. Run `npm install`, then `npm run create-admin` in a terminal. This prompts for the first admin's name, email, and password and inserts the account in MySQL.
6. Run `npm run dev`, then open `http://localhost:3000/admin/login` to sign in. The admin pages require an account.
7. Open `http://localhost:3000/events` to view published events.

New events are saved as drafts and require a feature photo. Configure ticket types and upload any additional photos/videos from an event's admin page before publishing. Ticket sales use PayFast sandbox unless `PAYFAST_MODE=live`; PayFast ITN callbacks need a public HTTPS `APP_BASE_URL`, so a local-only development URL cannot complete payment notifications.

Uploaded media is currently stored under `public/uploads/`. This works for local development and a single persistent server. Use persistent object storage (for example S3-compatible storage) before deploying to an environment with ephemeral local filesystems or multiple app instances.

## Current API

- Administrator APIs cover event details, status, tickets, media, and deletion. Admin sign-in uses an HTTP-only session cookie.
- Public events are served from `GET /api/public/events` and `GET /api/public/events/:id`.
- Ticket checkout creates a pending order and reserves stock, then sends the buyer to PayFast. Pending checkouts do not count as sales. Only a signature-checked, PayFast-validated ITN confirmation marks an order paid, reduces confirmed remaining inventory, and issues tickets. Failed or cancelled checkouts release their reservations.

## Project structure

- `src/app/` contains the Next.js frontend pages and thin API route adapters.
- `backend/routes/` contains the backend API implementations and database operations.
- `backend/lib/` contains backend-only services such as MySQL access and administrator authentication.
- `backend/database/` contains the MySQL schema and migrations.
- `backend/scripts/` contains backend maintenance commands, including administrator creation.

The frontend and backend code are separated into folders but run together in the existing Next.js application. This keeps the current `npm run dev` workflow and same-origin API URLs.

## Time handling

The initial event form uses local date and time input. Configure the application and eventual hosting environment for `Africa/Johannesburg` before adding event publishing and ticket sales.
