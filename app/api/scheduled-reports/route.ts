import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const getSupabasePool = () => {
  const SUPABASE_DATABASE_URL = process.env.SUPABASE_DATABASE_URL;

  if (!SUPABASE_DATABASE_URL) {
    throw new Error("SUPABASE_DATABASE_URL environment variable is not set");
  }

  return new Pool({
    connectionString: SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
  });
};

interface ScheduledReport {
  id: string;
  name: string;
  description: string | null;
  cron_expression: string;
  schedule_description: string | null;
  report_type: string;
  filter_params: object;
  is_active: boolean;
  trigger_job_id: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
  created_at: string;
  updated_at: string;
}

// GET: Fetch all scheduled reports
export async function GET() {
  const pool = getSupabasePool();

  try {
    const result = await pool.query<ScheduledReport>(
      `SELECT
        id,
        name,
        description,
        cron_expression,
        schedule_description,
        report_type,
        filter_params,
        is_active,
        trigger_job_id,
        last_run_at,
        last_run_status,
        last_run_error,
        created_at,
        updated_at
      FROM scheduled_reports
      ORDER BY name`
    );

    return NextResponse.json({
      reports: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching scheduled reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduled reports" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}

// PUT: Update a scheduled report
export async function PUT(request: NextRequest) {
  const pool = getSupabasePool();

  try {
    const body = await request.json();
    const { id, cron_expression, schedule_description, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (cron_expression !== undefined) {
      updates.push(`cron_expression = $${paramCount}`);
      values.push(cron_expression);
      paramCount++;
    }

    if (schedule_description !== undefined) {
      updates.push(`schedule_description = $${paramCount}`);
      values.push(schedule_description);
      paramCount++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    values.push(id); // Add id as last parameter

    const result = await pool.query<ScheduledReport>(
      `UPDATE scheduled_reports
       SET ${updates.join(", ")}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Scheduled report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      report: result.rows[0],
      message: "Scheduled report updated successfully",
    });
  } catch (error: unknown) {
    console.error("Error updating scheduled report:", error);

    // Handle cron validation error
    if (error && typeof error === 'object' && 'code' in error && error.code === "23514") {
      return NextResponse.json(
        { error: "Invalid cron expression format" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update scheduled report" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
