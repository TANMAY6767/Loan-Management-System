# Shaha Finlease recovery prototype

A demo debt-recovery operations workspace for accounts that have already been purchased. It supports portfolio import, caller allocation, customer contact history, payment promises, payment tracking, and role-scoped operational views. The prototype focuses on post-acquisition recovery work; it does not originate loans or manage portfolio purchases.

## Demo Video

[▶ Watch the Shaha Finlease Recovery Prototype Demo](https://drive.google.com/file/d/1MwhqZBvs7jl6UR6i1XRE_sOkHVfKF5lB/view?usp=sharing)

## Requirements

- Node.js 20 or newer
- PostgreSQL

## Start locally

1. Install dependencies from the repository root:

   ```sh
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

2. Copy `server/.env.example` to `server/.env` and set `DATABASE_URL` to a local PostgreSQL database. Set `JWT_SECRET` to any long random value for local use.

3. Create the tables and load demo users:

   ```sh
   npm run db:migrate
   npm run db:seed
   ```

4. Start the API and web app together:

   ```sh
   npm run dev
   ```

   Open `http://localhost:5173`.

## Demo logins

All seeded users use the demo password `shaha123`.

| Role | Username |
| --- | --- |
| Head of Collections | `u001` |
| COO | `u002` |
| Manager | `manager1` through `manager7` |
| Caller | `caller1` through `caller60` |

Managers can review unassigned accounts across offices and accounts assigned to their callers, and can allocate an account to any caller on their team regardless of office. Head and COO users can review the full workspace and allocate to any caller. Callers see only their own assigned accounts. Caller workload counts are visible to managers and Head/COO users. The seed also includes customer service demo users; these are scoped to their office.

## CSV import

Upload accepts up to 100,000 rows and files up to 20 MB. Headers use the snake_case names shown in the Import screen. `loan_no`, `customer_name`, `mobile`, a positive numeric `outstanding`, and a supported `office` are required. Invalid rows and duplicate loan numbers are skipped. Imported accounts start as `New` and unassigned; the CSV `status` column is ignored so imported portfolio records enter the recovery workflow consistently. Manager imports are limited to their own office.

## Assumptions and prototype limits

- The app starts with already purchased portfolios. Purchase costing, legal/field-agency workflows, and post-settlement processing are outside the prototype scope, so return-on-purchase calculations are not included.
- A promise remains pending through its due date. Payments recorded from the promise date through its due date count toward the promised amount; it is marked `Kept` once that amount is reached, or `Broken` on the following India calendar day if it is not. Expiry is applied when an account list, account detail, or dashboard is requested; the prototype does not run a background scheduler.
- Recording payments never changes the loaded outstanding amount. It adds to total paid. An ordinary payment leaves an account `Part_paid` until the original outstanding is fully repaid, when it becomes `Closed`. A payment explicitly marked as completing an approved settlement sets it to `Settled`, even when the agreed settlement is less than the original outstanding. Resolved accounts have no remaining balance for collection reporting. Payments beyond the original balance are rejected unless they complete an explicitly approved settlement.
- Dashboard collection KPIs show this month's receipts and all-time receipts. Remaining balance excludes accounts marked `Closed` or `Settled`. Manager and Head/COO dashboard views include current account counts for each caller in their scope.
- Account search, status, office, and page filters are kept separately for each signed-in user and workspace view.
- Seed data is synthetic. The common demo password is intentionally simple and must not be reused outside the local prototype.

## Project layout

- `client/src/pages` contains the main screens.
- `client/src/components` contains reusable account UI.
- `client/src/services` contains API calls.
- `server/src/controllers` contains request handling and business rules.
- `server/src/middleware` contains authentication and account access checks.
- `server/src/utils` contains shared scope, validation, and response helpers.
- `server/prisma` contains the database schema and migrations.
- `server/scripts/seed.js` loads the synthetic users and offices. Accounts are added through CSV import.
