# Production Deployment Guide

## Overview

This guide will help you deploy your automated report system to production, including:
- Next.js app deployment to Vercel
- Trigger.dev production setup
- Database configuration
- Scheduled report configuration

---

## Prerequisites

- [ ] Vercel account
- [ ] Trigger.dev account (already set up)
- [ ] Production Supabase database
- [ ] Production CrunchyBridge database access
- [ ] Production Resend API key
- [ ] Production Clerk credentials

---

## Step 1: Prepare Environment Variables

### Required Environment Variables for Production

```env
# Database Connections
CRUNCHYBRIDGE_DATABASE_URL=postgres://production_user:password@production_host:5432/postgres
SUPABASE_DATABASE_URL=postgresql://postgres:password@production_host:5432/postgres

# Email Service
RESEND_API_KEY=re_production_key_here
RESEND_FROM_EMAIL=reports@yourdomain.com

# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key
CLERK_SECRET_KEY=sk_live_your_production_secret

# Trigger.dev
TRIGGER_SECRET_KEY=tr_prod_your_production_key

# Application
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Worldpay (if needed)
WORLDPAY_API_KEY=your_production_key

# Database Settings
DB_SSL=true
DB_STATEMENT_TIMEOUT=30000
DB_IDLE_TIMEOUT=10000
DB_CONNECTION_TIMEOUT=5000
DB_MAX_CONNECTIONS=10
```

---

## Step 2: Deploy to Vercel

### 2.1 Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository
4. Select the `simple-topbox` directory as the root

### 2.2 Configure Build Settings

**Framework Preset:** Next.js
**Build Command:** `npm run build`
**Output Directory:** `.next`
**Install Command:** `npm install`

### 2.3 Add Environment Variables

In Vercel Project Settings → Environment Variables, add ALL the variables from Step 1.

**Important:** Make sure to set them for:
- ✅ Production
- ✅ Preview (optional)
- ⬜ Development (keep local)

### 2.4 Deploy

Click "Deploy" and wait for the build to complete.

Your app will be available at: `https://your-project.vercel.app`

---

## Step 3: Run Database Migration on Production

### 3.1 Connect to Production Supabase

```bash
psql $SUPABASE_DATABASE_URL
```

### 3.2 Run the Migration

```sql
-- Copy and paste the contents of:
-- database/migrations/001_create_report_recipients.sql
```

Or use the Supabase SQL Editor:
1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Paste the migration SQL
4. Click "Run"

### 3.3 Verify Tables

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('report_recipients', 'scheduled_reports', 'scheduled_report_recipients');
```

You should see all three tables.

---

## Step 4: Add Production Recipients

### Option A: Via UI (Recommended)

1. Go to `https://your-app.vercel.app/dashboard/recipients`
2. Click "Add Recipient"
3. Enter production email addresses
4. Verify they're added successfully

### Option B: Via SQL

```sql
INSERT INTO report_recipients (email, name, is_active)
VALUES
  ('recipient1@example.com', 'Recipient One', true),
  ('recipient2@example.com', 'Recipient Two', true);
```

### Sync Recipients to Scheduled Report

```sql
INSERT INTO scheduled_report_recipients (scheduled_report_id, recipient_id)
SELECT
  sr.id,
  rr.id
FROM scheduled_reports sr
CROSS JOIN report_recipients rr
WHERE sr.name = 'Daily Event Report'
  AND sr.is_active = true
  AND rr.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM scheduled_report_recipients srr
    WHERE srr.scheduled_report_id = sr.id
      AND srr.recipient_id = rr.id
  );
```

---

## Step 5: Deploy Trigger.dev to Production

### 5.1 Build and Deploy

In your project root:

```bash
# Build the trigger tasks
npx trigger.dev@latest deploy

# Follow the prompts:
# - Select your project
# - Confirm production deployment
# - Wait for deployment to complete
```

### 5.2 Verify Deployment

1. Go to [Trigger.dev Dashboard](https://cloud.trigger.dev)
2. Navigate to your project
3. Check "Tasks" tab - you should see `daily-event-report`
4. Click on the task to view details

### 5.3 Test Production Task

Click "Test" to run the task manually and verify:
- ✅ Connects to production databases
- ✅ Fetches recipients
- ✅ Sends emails
- ✅ Updates last run status

---

## Step 6: Configure Production Schedule

### 6.1 Via UI (Recommended)

1. Go to `https://your-app.vercel.app/dashboard/schedule`
2. Select your desired time (e.g., 9:00 AM)
3. Select timezone (default: Central Time - Texas)
4. Ensure "Enable automatic reports" is checked
5. Click "Save Schedule"

The system will:
- Convert your local time to UTC
- Update the cron expression in the database
- Enable the scheduled report

### 6.2 Via Trigger.dev Dashboard

Alternatively, set up the schedule directly in Trigger.dev:

1. Go to your Trigger.dev project
2. Click on `daily-event-report` task
3. Go to "Schedules" tab
4. Click "Create Schedule"
5. Enter details:
   - **Name:** Daily Report - 9 AM CT
   - **Cron:** `0 14 * * *` (9 AM Central = 2 PM UTC in winter, 3 PM in summer)
   - **Timezone:** `America/Chicago`
6. Save

**Note:** Trigger.dev schedules support timezone-aware cron, so you can use `America/Chicago` directly!

---

## Step 7: Monitor & Verify

### 7.1 Check Schedule Status

Go to `https://your-app.vercel.app/dashboard/schedule` to see:
- Current schedule configuration
- Last run status
- Last run time
- Any errors

### 7.2 Monitor Trigger.dev Runs

In Trigger.dev Dashboard:
1. Go to "Runs" tab
2. View execution history
3. Check logs for any errors
4. Monitor email delivery status

### 7.3 Check Email Delivery

- Check Resend dashboard for email delivery metrics
- Verify recipients are receiving emails
- Check spam folders if emails aren't arriving

---

## Troubleshooting

### Issue: Task Fails with "Connection Refused"

**Cause:** Environment variables not set in Trigger.dev

**Solution:**
1. Go to Trigger.dev project settings
2. Add environment variables:
   ```
   CRUNCHYBRIDGE_DATABASE_URL
   SUPABASE_DATABASE_URL
   RESEND_API_KEY
   RESEND_FROM_EMAIL
   ```
3. Redeploy: `npx trigger.dev@latest deploy`

### Issue: Emails Not Sending

**Possible Causes:**
- Invalid RESEND_API_KEY
- Sender email not verified in Resend
- Recipients marked as inactive

**Solution:**
1. Verify API key in Resend dashboard
2. Verify sender domain in Resend
3. Check recipient status in `/dashboard/recipients`

### Issue: Wrong Timezone

**Cause:** Cron is in UTC but time appears wrong

**Solution:**
1. Go to `/dashboard/schedule`
2. Select correct timezone
3. Save - it will auto-convert to UTC

### Issue: No Recipients Found

**Cause:** Recipients not synced to scheduled report

**Solution:**
Run the sync SQL:
```sql
-- See Step 4 above
```

---

## Production Checklist

Before going live, verify:

- [ ] All environment variables are set in Vercel
- [ ] Database migration completed on production Supabase
- [ ] Recipients added and synced to scheduled report
- [ ] Trigger.dev task deployed to production
- [ ] Schedule configured (either via UI or Trigger.dev)
- [ ] Test run successful (check Trigger.dev logs)
- [ ] Test email received by at least one recipient
- [ ] Clerk production keys configured
- [ ] Resend sender domain verified
- [ ] Timezone correctly set
- [ ] Schedule active in database

---

## Ongoing Maintenance

### Daily

- Check `/dashboard/schedule` for last run status
- Monitor Trigger.dev dashboard for failures

### Weekly

- Review email delivery metrics in Resend
- Check for bounced emails
- Update recipient list as needed

### Monthly

- Review database usage (Supabase)
- Review Trigger.dev usage and costs
- Audit recipient list

---

## Scaling Considerations

### Multiple Reports

To add more scheduled reports:

1. Create new row in `scheduled_reports` table
2. Associate recipients via `scheduled_report_recipients`
3. Create corresponding Trigger.dev task
4. Configure schedule

### Custom Report Types

Modify the Trigger.dev task to support different report types:
- Seat lookup reports
- Custom SQL queries
- Multi-format exports (PDF, Excel)

### Multiple Organizations

Add `organization_id` filtering:
1. Update recipient queries to filter by org
2. Create separate scheduled reports per org
3. Configure different schedules per org

---

## Support & Resources

- **Trigger.dev Docs:** https://trigger.dev/docs
- **Vercel Docs:** https://vercel.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **Resend Docs:** https://resend.com/docs

---

## Cost Estimates (Monthly)

Based on typical usage:

- **Vercel:** Free (Hobby) or $20/mo (Pro)
- **Trigger.dev:** Free tier (2,500 runs/mo) or $20/mo (Pro)
- **Supabase:** Free tier or $25/mo (Pro)
- **Resend:** Free (100 emails/day) or $20/mo (Pro)
- **Clerk:** Free (10k MAU) or $25/mo (Production)

**Total:** $0-$110/month depending on tier selection
