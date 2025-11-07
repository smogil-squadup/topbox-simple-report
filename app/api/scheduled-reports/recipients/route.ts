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

// GET: Fetch all recipients for a scheduled report
export async function GET(request: NextRequest) {
  const pool = getSupabasePool();

  try {
    const { searchParams } = new URL(request.url);
    const scheduledReportId = searchParams.get("scheduled_report_id");

    if (!scheduledReportId) {
      return NextResponse.json(
        { error: "scheduled_report_id is required" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT
        rr.id,
        rr.email,
        rr.name,
        rr.is_active
      FROM scheduled_report_recipients srr
      JOIN report_recipients rr ON srr.recipient_id = rr.id
      WHERE srr.scheduled_report_id = $1
      ORDER BY rr.email`,
      [scheduledReportId]
    );

    return NextResponse.json({
      recipients: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching scheduled report recipients:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipients" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}

// POST: Add a recipient to a scheduled report
export async function POST(request: NextRequest) {
  const pool = getSupabasePool();

  try {
    const body = await request.json();
    const { scheduled_report_id, recipient_id } = body;

    if (!scheduled_report_id || !recipient_id) {
      return NextResponse.json(
        { error: "scheduled_report_id and recipient_id are required" },
        { status: 400 }
      );
    }

    await pool.query(
      `INSERT INTO scheduled_report_recipients (scheduled_report_id, recipient_id)
       VALUES ($1, $2)
       ON CONFLICT (scheduled_report_id, recipient_id) DO NOTHING`,
      [scheduled_report_id, recipient_id]
    );

    return NextResponse.json({
      message: "Recipient added to scheduled report successfully",
    });
  } catch (error) {
    console.error("Error adding recipient to scheduled report:", error);
    return NextResponse.json(
      { error: "Failed to add recipient to scheduled report" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}

// DELETE: Remove a recipient from a scheduled report
export async function DELETE(request: NextRequest) {
  const pool = getSupabasePool();

  try {
    const { searchParams } = new URL(request.url);
    const scheduled_report_id = searchParams.get("scheduled_report_id");
    const recipient_id = searchParams.get("recipient_id");

    if (!scheduled_report_id || !recipient_id) {
      return NextResponse.json(
        { error: "scheduled_report_id and recipient_id are required" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `DELETE FROM scheduled_report_recipients
       WHERE scheduled_report_id = $1 AND recipient_id = $2
       RETURNING id`,
      [scheduled_report_id, recipient_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Association not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Recipient removed from scheduled report successfully",
    });
  } catch (error) {
    console.error("Error removing recipient from scheduled report:", error);
    return NextResponse.json(
      { error: "Failed to remove recipient from scheduled report" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
