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

// POST: Sync all active recipients to all active scheduled reports
export async function POST(request: NextRequest) {
  const pool = getSupabasePool();

  try {
    // This query adds all active recipients to all active scheduled reports
    // that don't already have them associated
    const result = await pool.query(`
      INSERT INTO scheduled_report_recipients (scheduled_report_id, recipient_id)
      SELECT sr.id, rr.id
      FROM scheduled_reports sr
      CROSS JOIN report_recipients rr
      WHERE sr.is_active = true
        AND rr.is_active = true
        AND NOT EXISTS (
          SELECT 1
          FROM scheduled_report_recipients srr
          WHERE srr.scheduled_report_id = sr.id
            AND srr.recipient_id = rr.id
        )
      RETURNING *
    `);

    return NextResponse.json({
      message: "Recipients synced successfully",
      added: result.rows.length,
    });
  } catch (error) {
    console.error("Error syncing recipients:", error);
    return NextResponse.json(
      { error: "Failed to sync recipients" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
