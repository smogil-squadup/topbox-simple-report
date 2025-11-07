# Report Recipients Setup Guide

This guide walks you through setting up the report recipients system and integrating it with Trigger.dev for scheduled automated reports.

## Table of Contents
1. [Database Setup](#database-setup)
2. [Using the Recipients UI](#using-the-recipients-ui)
3. [Trigger.dev Integration](#triggerdeg-integration)
4. [API Endpoints](#api-endpoints)
5. [Troubleshooting](#troubleshooting)

---

## Database Setup

### 1. Run the Migration

Execute the SQL migration script on your **Supabase database** (not the read-only CrunchyBridge database):

```bash
# Connect to your Supabase PostgreSQL database
psql postgresql://postgres:hGWIJnKmnscI4uNd@db.pifxkqaukclpzkstqfzk.supabase.co:5432/postgres

# Or run via Supabase SQL Editor (recommended)
# Copy and paste the contents of database/migrations/001_create_report_recipients.sql
```

The migration creates three tables:

#### `report_recipients`
Stores email recipients for automated reports.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `email` | VARCHAR(255) | Recipient email (validated) |
| `name` | VARCHAR(255) | Recipient name (optional) |
| `organization_id` | VARCHAR(255) | For multi-tenancy support |
| `is_active` | BOOLEAN | Active/inactive status |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

#### `scheduled_reports`
Stores configuration for scheduled report jobs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | VARCHAR(255) | Report name |
| `description` | TEXT | Report description |
| `cron_expression` | VARCHAR(100) | Cron schedule (e.g., "0 9 * * *") |
| `schedule_description` | VARCHAR(255) | Human-readable schedule |
| `report_type` | VARCHAR(50) | Type: 'event_list', 'seat_lookup', 'custom' |
| `filter_params` | JSONB | Flexible filtering parameters |
| `is_active` | BOOLEAN | Active/inactive status |
| `trigger_job_id` | VARCHAR(255) | Trigger.dev job ID |
| `last_run_at` | TIMESTAMP | Last execution time |
| `last_run_status` | VARCHAR(50) | Last execution status |
| `last_run_error` | TEXT | Last error (if any) |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

#### `scheduled_report_recipients`
Junction table linking reports to recipients (many-to-many).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `scheduled_report_id` | UUID | Foreign key to scheduled_reports |
| `recipient_id` | UUID | Foreign key to report_recipients |
| `created_at` | TIMESTAMP | Creation timestamp |

### 2. Verify Installation

```sql
-- Check tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('report_recipients', 'scheduled_reports', 'scheduled_report_recipients');

-- Check default scheduled report
SELECT * FROM scheduled_reports;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('report_recipients', 'scheduled_reports', 'scheduled_report_recipients');
```

---

## Using the Recipients UI

### Access the UI

Navigate to: `/dashboard/recipients`

### Features

1. **Add Recipients**
   - Click "Add Recipient" button
   - Enter email (required) and name (optional)
   - Email validation is enforced
   - Duplicate emails are prevented

2. **Edit Recipients**
   - Click the pencil icon on any recipient
   - Update email or name
   - Changes are saved immediately

3. **Toggle Active/Inactive**
   - Click the status badge to toggle
   - Inactive recipients won't receive scheduled reports
   - Useful for temporary pauses without deletion

4. **Delete Recipients**
   - Click the trash icon
   - Confirmation dialog appears
   - Cascading delete removes from scheduled report associations

5. **View Summary**
   - Total recipients count
   - Active recipients count
   - Inactive recipients count

---

## Trigger.dev Integration

### Prerequisites

1. **Install Trigger.dev**
   ```bash
   npm install @trigger.dev/sdk
   npx trigger.dev init
   ```

2. **Add Environment Variables**
   ```env
   TRIGGER_API_KEY=your_trigger_api_key
   TRIGGER_API_URL=https://api.trigger.dev
   ```

### Create a Scheduled Report Job

Create a file: `jobs/scheduled-event-report.ts`

```typescript
import { cronTrigger } from "@trigger.dev/sdk";
import { client } from "@/trigger";
import { Pool } from "pg";

// Define the scheduled job
client.defineJob({
  id: "daily-event-report",
  name: "Daily Event Report",
  version: "1.0.0",
  trigger: cronTrigger({
    cron: "0 9 * * *", // Every day at 9 AM
  }),
  run: async (payload, io, ctx) => {
    // Fetch active recipients from Supabase
    const pool = new Pool({
      connectionString: process.env.SUPABASE_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    const recipients = await pool.query(`
      SELECT email, name
      FROM report_recipients
      WHERE is_active = true
    `);

    await io.logger.info(`Found ${recipients.rows.length} active recipients`);

    // Fetch the report data
    const reportData = await io.runTask("fetch-report-data", async () => {
      // Call your existing API endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/seat-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      return await response.json();
    });

    // Send emails to each recipient
    for (const recipient of recipients.rows) {
      await io.runTask(`send-email-${recipient.email}`, async () => {
        // Send email using your existing /api/send-report endpoint
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: recipient.email,
            name: recipient.name,
            reportData: reportData.results,
          }),
        });

        await io.logger.info(`Sent report to ${recipient.email}`);
        return await response.json();
      });
    }

    // Update last run status
    await pool.query(`
      UPDATE scheduled_reports
      SET last_run_at = NOW(),
          last_run_status = 'success'
      WHERE name = 'Daily Event Report'
    `);

    await pool.end();

    return {
      recipientCount: recipients.rows.length,
      status: "success",
    };
  },
});
```

### Deploy to Trigger.dev

```bash
# Test locally
npx trigger.dev dev

# Deploy to production
npx trigger.dev deploy
```

### Link Job ID to Database

After deploying, update the database with the Trigger.dev job ID:

```sql
UPDATE scheduled_reports
SET trigger_job_id = 'daily-event-report'
WHERE name = 'Daily Event Report';
```

### Cron Expression Examples

```
0 9 * * *       # Every day at 9:00 AM
0 9 * * 1       # Every Monday at 9:00 AM
0 9 1 * *       # First day of every month at 9:00 AM
0 */6 * * *     # Every 6 hours
0 9,17 * * *    # Every day at 9:00 AM and 5:00 PM
0 9 * * 1-5     # Weekdays at 9:00 AM
```

---

## API Endpoints

### GET `/api/recipients`
Fetch all recipients.

**Response:**
```json
{
  "recipients": [
    {
      "id": "uuid",
      "email": "recipient@example.com",
      "name": "John Doe",
      "organization_id": null,
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

### POST `/api/recipients`
Create a new recipient.

**Request:**
```json
{
  "email": "new@example.com",
  "name": "Jane Smith",
  "organization_id": null
}
```

**Response:**
```json
{
  "recipient": { ... },
  "message": "Recipient created successfully"
}
```

### PUT `/api/recipients`
Update an existing recipient.

**Request:**
```json
{
  "id": "uuid",
  "email": "updated@example.com",
  "name": "Updated Name",
  "is_active": false
}
```

### DELETE `/api/recipients?id=<uuid>`
Delete a recipient.

**Response:**
```json
{
  "message": "Recipient deleted successfully"
}
```

---

## Troubleshooting

### Issue: Migration Fails with "relation already exists"

**Solution:** Tables already exist. Drop and recreate:
```sql
DROP TABLE IF EXISTS scheduled_report_recipients CASCADE;
DROP TABLE IF EXISTS scheduled_reports CASCADE;
DROP TABLE IF EXISTS report_recipients CASCADE;
-- Then re-run migration
```

### Issue: "Failed to fetch recipients" in UI

**Cause:** SUPABASE_DATABASE_URL environment variable not set or incorrect.

**Solution:**
1. Verify `.env.local` has both database URLs:
   - `CRUNCHYBRIDGE_DATABASE_URL` - for event/payment data (read-only)
   - `SUPABASE_DATABASE_URL` - for report recipients (read-write)
2. Restart Next.js dev server: `npm run dev`

### Issue: Email validation fails

**Cause:** Invalid email format.

**Solution:** Ensure email matches pattern: `user@domain.com`

### Issue: Trigger.dev job not running

**Cause:**
- Job not deployed
- Cron expression invalid
- Environment variables missing

**Solution:**
1. Verify deployment: `npx trigger.dev status`
2. Check cron syntax: Use [crontab.guru](https://crontab.guru)
3. Verify TRIGGER_API_KEY is set

### Issue: Reports not sending to recipients

**Cause:**
- Recipients marked as inactive
- Email API (Resend) credentials missing
- Report generation failing

**Solution:**
1. Check `is_active` status in database
2. Verify RESEND_API_KEY in environment
3. Test `/api/send-report` endpoint manually

---

## Next Steps

1. ✅ **Database Migration** - Complete
2. ✅ **Recipients UI** - Complete
3. 🔄 **Trigger.dev Setup** - Follow integration guide above
4. 📧 **Email Templates** - Customize email content in `/api/send-report`
5. 📊 **Advanced Reports** - Add more report types (seat lookup, custom queries)
6. 🔔 **Notifications** - Add webhook notifications for job failures
7. 📈 **Analytics** - Track delivery rates and engagement

---

## Support

For issues or questions:
- Check the [Trigger.dev docs](https://trigger.dev/docs)
- Review [Supabase docs](https://supabase.com/docs)
- Check application logs in Vercel or local console
