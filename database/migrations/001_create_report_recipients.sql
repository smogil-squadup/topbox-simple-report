-- Migration: Create report recipients and scheduled reports tables
-- This schema supports trigger.dev scheduled jobs for automated report delivery

-- Table: report_recipients
-- Stores email recipients who should receive automated event reports
CREATE TABLE IF NOT EXISTS report_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),

  -- Organization/User association (if you have multi-tenancy)
  -- For now, assuming single organization, but leaving room for expansion
  organization_id VARCHAR(255),

  -- Active status - allows disabling recipients without deleting
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT unique_email_per_org UNIQUE (email, organization_id)
);

-- Table: scheduled_reports
-- Stores configuration for scheduled report jobs (used by trigger.dev)
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Schedule configuration
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Cron expression for trigger.dev
  -- Examples:
  --   "0 9 * * *" = Daily at 9 AM
  --   "0 9 * * 1" = Every Monday at 9 AM
  --   "0 9 1 * *" = First day of month at 9 AM
  cron_expression VARCHAR(100) NOT NULL,

  -- Human-readable schedule description
  schedule_description VARCHAR(255),

  -- Report configuration
  report_type VARCHAR(50) NOT NULL DEFAULT 'event_list',

  -- Filter parameters (stored as JSONB for flexibility)
  -- Example: {"hostUserId": 123, "dateRange": "last_30_days"}
  filter_params JSONB DEFAULT '{}'::jsonb,

  -- Active status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Trigger.dev job ID (populated when job is created)
  trigger_job_id VARCHAR(255),

  -- Last run tracking
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_run_status VARCHAR(50),
  last_run_error TEXT,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_report_type CHECK (report_type IN ('event_list', 'seat_lookup', 'custom')),
  CONSTRAINT valid_cron CHECK (cron_expression ~ '^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$')
);

-- Junction table: scheduled_report_recipients
-- Links scheduled reports to their recipients (many-to-many)
CREATE TABLE IF NOT EXISTS scheduled_report_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_report_id UUID NOT NULL REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES report_recipients(id) ON DELETE CASCADE,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_report_recipient UNIQUE (scheduled_report_id, recipient_id)
);

-- Indexes for performance
CREATE INDEX idx_report_recipients_email ON report_recipients(email);
CREATE INDEX idx_report_recipients_active ON report_recipients(is_active) WHERE is_active = true;
CREATE INDEX idx_report_recipients_org ON report_recipients(organization_id);

CREATE INDEX idx_scheduled_reports_active ON scheduled_reports(is_active) WHERE is_active = true;
CREATE INDEX idx_scheduled_reports_trigger_job ON scheduled_reports(trigger_job_id);
CREATE INDEX idx_scheduled_reports_type ON scheduled_reports(report_type);

CREATE INDEX idx_scheduled_report_recipients_report ON scheduled_report_recipients(scheduled_report_id);
CREATE INDEX idx_scheduled_report_recipients_recipient ON scheduled_report_recipients(recipient_id);

-- Function: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers: Auto-update timestamps
CREATE TRIGGER update_report_recipients_updated_at
  BEFORE UPDATE ON report_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed data: Default daily report schedule
INSERT INTO scheduled_reports (
  name,
  description,
  cron_expression,
  schedule_description,
  report_type,
  is_active
) VALUES (
  'Daily Event Report',
  'Automated daily event list report sent to all active recipients',
  '0 9 * * *',
  'Every day at 9:00 AM',
  'event_list',
  true
) ON CONFLICT DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE report_recipients IS 'Email recipients for automated event reports';
COMMENT ON TABLE scheduled_reports IS 'Configuration for scheduled report jobs (used by trigger.dev)';
COMMENT ON TABLE scheduled_report_recipients IS 'Links scheduled reports to their recipients';

COMMENT ON COLUMN scheduled_reports.cron_expression IS 'Cron expression for trigger.dev scheduling. Format: minute hour day month weekday';
COMMENT ON COLUMN scheduled_reports.trigger_job_id IS 'Trigger.dev job ID - populated when job is created in trigger.dev';
COMMENT ON COLUMN scheduled_reports.filter_params IS 'JSONB field for flexible report filtering parameters';
