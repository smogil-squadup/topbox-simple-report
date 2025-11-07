# Quick Fix: Sync Recipients to Scheduled Report

## Step 1: Restart Next.js Dev Server

The API routes we created aren't loaded yet. In your terminal running `npm run dev`:

1. Press `Ctrl+C` to stop the server
2. Run `npm run dev` again

## Step 2: Sync Recipients via Browser

Instead of using curl, just open this URL in your browser:

```
http://localhost:3000/api/scheduled-reports/sync-all-recipients
```

You should see a JSON response like:
```json
{
  "message": "Recipients synced successfully",
  "added": 2
}
```

The number `added` shows how many recipient associations were created.

## Step 3: Verify in Database (Optional)

Connect to your Supabase database and run:

```sql
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

You should see your recipients listed with "Daily Event Report".

## Step 4: Test Trigger.dev Again

Now go back to your Trigger.dev dashboard and click "Test" on the daily-event-report task.

It should now find recipients and send emails!

---

## Alternative: Manual SQL Insert

If the API still doesn't work, you can manually insert the associations in Supabase:

```sql
-- First, get the scheduled report ID
SELECT id, name FROM scheduled_reports WHERE name = 'Daily Event Report';

-- Then, get your recipient IDs
SELECT id, email FROM report_recipients WHERE is_active = true;

-- Insert associations (replace UUIDs with actual values from above)
INSERT INTO scheduled_report_recipients (scheduled_report_id, recipient_id)
SELECT
  (SELECT id FROM scheduled_reports WHERE name = 'Daily Event Report' LIMIT 1),
  id
FROM report_recipients
WHERE is_active = true
ON CONFLICT (scheduled_report_id, recipient_id) DO NOTHING;
```

This will associate all active recipients with the scheduled report.
