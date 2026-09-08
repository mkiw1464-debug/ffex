# FFEX License System v2

Next.js + Supabase license key management.

## New in v2
- **Reset HWID** — admin & reseller can reset a key's HWID binding. Key returns to `unused`.
- **Device history** — every `/api/licenses/validate` call with a HWID is logged. View per-key via "Devices" button.
- **Global keys** — admin-only. 1 key, unlimited devices. No HWID binding. Useful for shared/team licenses.
- **Redesigned UI** — grey + purple dark theme, cleaner dashboard, modal for device logs.

## Setup

1. **Supabase** — run `database/schema.sql` (fresh) OR `database/migration-v2.sql` (upgrade from v1)
2. **Env** — copy `.env.local` and fill in your values:
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   JWT_SECRET=...
   ADMIN_USERNAME=...
   ADMIN_PASSWORD=...
   ```
3. `npm install && npm run dev`

## Key System

| Type     | HWID Lock | Devices  | Who can create |
|----------|-----------|----------|----------------|
| Normal   | ✅ Yes    | 1        | Admin + Reseller |
| Global   | ❌ No     | Unlimited | Admin only     |

## API

- `POST /api/licenses/validate` — validate a key (`{ key, hwid }`)
- `GET  /api/licenses` — list keys (auth)
- `POST /api/licenses` — create keys (auth, `{ days, quantity, is_global? }`)
- `PATCH /api/licenses` — actions: `ban`, `unban`, `delete`, `reset_hwid`
- `GET  /api/licenses/devices?key=FFEX-XXX` — device login history (auth)
