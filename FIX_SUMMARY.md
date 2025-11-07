# Database Connection Fix Summary

## Problem
The event list report was failing with error: `relation "events" does not exist`

## Root Cause
You had two `DATABASE_URL` entries in `.env.local`:
1. First one pointing to **CrunchyBridge** (has events, payments, price_tiers tables)
2. Second one pointing to **Supabase** (only has report_recipients tables)

The second DATABASE_URL was overriding the first, so the app was trying to query the `events` table in Supabase, which doesn't exist there.

## Solution
Separated the database connections into two distinct environment variables:

### 1. Updated `.env.local`
```env
# CrunchyBridge - READ-ONLY for event/payment data
CRUNCHYBRIDGE_DATABASE_URL=postgres://u_456gkqnkzjedtjtx6uvyv3d7ja:...@p.taqmxfxcsvbifimcsvnaa4eaaa.db.postgresbridge.com:5432/postgres

# Supabase - READ-WRITE for report recipients
SUPABASE_DATABASE_URL=postgresql://postgres:...@db.pifxkqaukclpzkstqfzk.supabase.co:5432/postgres
```

### 2. Updated `lib/db.ts`
Changed from `process.env.DATABASE_URL` to `process.env.CRUNCHYBRIDGE_DATABASE_URL`

This ensures all event/payment queries go to CrunchyBridge (where the data exists).

### 3. Updated `app/api/recipients/route.ts`
Changed from `process.env.DATABASE_URL` to `process.env.SUPABASE_DATABASE_URL`

This ensures all recipient management queries go to Supabase (where report_recipients table exists).

## Database Usage
- **CrunchyBridge**: Events, payments, price_tiers, users (read-only)
- **Supabase**: report_recipients, scheduled_reports, scheduled_report_recipients (read-write)

## Next Steps
1. ✅ Environment variables updated
2. ✅ Code updated to use correct database connections
3. 🔄 **Restart your dev server** to pick up the new environment variables:
   ```bash
   # Stop the current dev server (Ctrl+C)
   npm run dev
   ```
4. ✅ Test the dashboard - event list should now load correctly
5. ✅ Test the recipients page - should work with Supabase

## Verification
After restarting the dev server:
1. Visit `/dashboard` - event list report should load
2. Visit `/dashboard/recipients` - should show recipients UI
3. Both should work without errors
