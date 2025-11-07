# Trigger.dev Setup & Testing Guide

## Quick Start

### 1. Sync Recipients to Scheduled Report

First, you need to associate your recipients with the scheduled report. Run this in your browser console or via curl:

```bash
# Sync all active recipients to all active scheduled reports
curl -X POST http://localhost:3000/api/scheduled-reports/sync-all-recipients
```

Or visit this URL in your browser and you'll see a JSON response showing how many recipients were added.

### 2. Verify Recipients Are Associated

Check the database:

```sql
-- See which recipients are associated with the scheduled report
SELECT
  sr.name AS report_name,
  rr.email,
  rr.name AS recipient_name,
  rr.is_active
FROM scheduled_report_recipients srr
JOIN scheduled_reports sr ON srr.scheduled_report_id = sr.id
JOIN report_recipients rr ON srr.recipient_id = rr.id
ORDER BY sr.name, rr.email;
```

### 3. Start Trigger.dev in Development Mode

Open a **new terminal window** (keep your Next.js dev server running) and run:

```bash
npx trigger.dev@latest dev
```

This will:
- Connect to your Trigger.dev account
- Register your tasks
- Start listening for test runs

### 4. Test the Task Manually

Once Trigger.dev dev is running, you can:

**Option A: Via Trigger.dev Dashboard**
1. Go to your Trigger.dev dashboard: https://cloud.trigger.dev
2. Navigate to your project
3. Find the "daily-event-report" task
4. Click "Test" to trigger it manually

**Option B: Via Code**
Create a test file to trigger it programmatically (optional):

```typescript
// test-trigger.ts
import { dailyEventReport } from "./src/trigger/daily-event-report";

// Trigger the task
await dailyEventReport.trigger({
  scheduledReportId: "your-report-id-here"
});
```

## Common Issues & Solutions

### Issue: "npx trigger.dev@latest dev" fails

**Possible causes:**
1. Missing TRIGGER_SECRET_KEY in .env.local
2. Wrong project ID in trigger.config.ts
3. Trigger.dev CLI not authenticated

**Solutions:**

1. **Check Environment Variables**
   ```bash
   # Verify TRIGGER_SECRET_KEY is set
   cat .env.local | grep TRIGGER_SECRET_KEY
   ```

2. **Login to Trigger.dev**
   ```bash
   npx trigger.dev@latest login
   ```

3. **Verify trigger.config.ts**
   Make sure the project ID matches your Trigger.dev project:
   ```typescript
   export default defineConfig({
     project: "proj_hdtrevgkigcnrhyeayhm", // <- Should match your project
     dirs: ["./src/trigger"], // <- Tasks are in src/trigger/
   });
   ```

### Issue: Task doesn't appear in dashboard

**Solution:**
1. Make sure trigger.dev dev is running
2. Check that the task is exported in src/trigger/index.ts
3. Restart the trigger.dev dev command

### Issue: Email sending fails

**Causes:**
- RESEND_API_KEY not set
- NEXT_PUBLIC_APP_URL incorrect
- Next.js dev server not running

**Solution:**
1. Ensure Next.js dev server is running on localhost:3000
2. Check RESEND_API_KEY is valid
3. Check logs in Trigger.dev dashboard for specific errors

## Development Workflow

### Terminal Setup
You'll need **TWO terminal windows**:

**Terminal 1: Next.js Dev Server**
```bash
npm run dev
```

**Terminal 2: Trigger.dev Dev**
```bash
npx trigger.dev@latest dev
```

### Testing Flow
1. Add recipients via the UI at `/dashboard/recipients`
2. Sync recipients to scheduled report (run the curl command above)
3. Trigger the task manually from Trigger.dev dashboard
4. Check your email inbox for the report
5. Check Trigger.dev logs for debugging

## Environment Variables Needed

Make sure these are in your `.env.local`:

```env
# Database connections
CRUNCHYBRIDGE_DATABASE_URL=postgres://...  # For reading event data
SUPABASE_DATABASE_URL=postgresql://...     # For recipients

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=topbox@hof.sammogil.com

# Trigger.dev
TRIGGER_SECRET_KEY=tr_dev_...
NEXT_PUBLIC_APP_URL=http://localhost:3000  # For development
```

## Scheduling for Production

Once everything works in development, you can set up scheduled runs:

### Option 1: Trigger.dev Schedules (Recommended)

In your Trigger.dev dashboard:
1. Go to your project
2. Click on the "daily-event-report" task
3. Click "Schedules" tab
4. Click "Create Schedule"
5. Enter cron expression: `0 9 * * *` (9 AM daily)
6. Save

### Option 2: Code-based Schedules

Update the task definition to include a schedule:

```typescript
import { schedules } from "@trigger.dev/sdk/v3";

export const dailyEventReport = task({
  id: "daily-event-report",
  run: async (payload, { ctx }) => {
    // ... existing code
  },
});

// Create a schedule
schedules.create({
  task: dailyEventReport,
  cron: "0 9 * * *", // Every day at 9 AM
  externalId: "daily-event-report-schedule",
});
```

## Monitoring

### Check Last Run Status

Query the database to see when reports last ran:

```sql
SELECT
  name,
  last_run_at,
  last_run_status,
  last_run_error,
  cron_expression,
  is_active
FROM scheduled_reports
ORDER BY last_run_at DESC;
```

### View Logs

- Development: Check your terminal running `trigger.dev dev`
- Production: Go to Trigger.dev dashboard > Runs

## What the Task Does

1. **Fetches Recipients**: Gets all active recipients associated with the "Daily Event Report" scheduled report
2. **Fetches Event Data**: Queries CrunchyBridge for event list data (same as the dashboard shows)
3. **Sends Emails**: Calls your `/api/send-report` endpoint for each recipient
4. **Updates Status**: Records the run status in the `scheduled_reports` table

## Next Steps

- ✅ Sync recipients to scheduled report
- ✅ Test task manually
- ✅ Verify emails are sent
- 📅 Set up production schedule
- 🔔 Add error notifications (Slack, email, etc.)
- 📊 Add more report types (seat lookup, custom queries)
