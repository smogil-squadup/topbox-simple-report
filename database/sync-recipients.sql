-- Sync all active recipients to the Daily Event Report
-- Run this in your Supabase SQL Editor

INSERT INTO scheduled_report_recipients (scheduled_report_id, recipient_id)
SELECT
  sr.id AS scheduled_report_id,
  rr.id AS recipient_id
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

-- Verify the associations were created
SELECT
  sr.name AS report_name,
  rr.email,
  rr.name AS recipient_name,
  rr.is_active,
  srr.created_at
FROM scheduled_report_recipients srr
JOIN scheduled_reports sr ON srr.scheduled_report_id = sr.id
JOIN report_recipients rr ON srr.recipient_id = rr.id
WHERE sr.name = 'Daily Event Report'
ORDER BY rr.email;
