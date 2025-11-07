import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

// Create a separate pool for Supabase (write operations)
const getSupabasePool = () => {
  const SUPABASE_DATABASE_URL = process.env.SUPABASE_DATABASE_URL;

  if (!SUPABASE_DATABASE_URL) {
    throw new Error("SUPABASE_DATABASE_URL environment variable is not set");
  }

  // Use the Supabase connection from .env
  return new Pool({
    connectionString: SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
  });
};

interface Recipient {
  id: string;
  email: string;
  name: string | null;
  organization_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// GET: Fetch all recipients
export async function GET() {
  const pool = getSupabasePool();

  try {
    const result = await pool.query<Recipient>(
      `SELECT
        id,
        email,
        name,
        organization_id,
        is_active,
        created_at,
        updated_at
      FROM report_recipients
      ORDER BY created_at DESC`
    );

    return NextResponse.json({
      recipients: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching recipients:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipients" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}

// POST: Create a new recipient
export async function POST(request: NextRequest) {
  const pool = getSupabasePool();

  try {
    const body = await request.json();
    const { email, name, organization_id } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Start a transaction to insert into both tables
    await pool.query("BEGIN");

    try {
      // 1. Insert into report_recipients
      const result = await pool.query<Recipient>(
        `INSERT INTO report_recipients (email, name, organization_id, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING id, email, name, organization_id, is_active, created_at, updated_at`,
        [email, name || null, organization_id || null]
      );

      const newRecipient = result.rows[0];

      // 2. Automatically add to all active scheduled reports
      const associationResult = await pool.query(
        `INSERT INTO scheduled_report_recipients (scheduled_report_id, recipient_id)
         SELECT sr.id, $1
         FROM scheduled_reports sr
         WHERE sr.is_active = true
         ON CONFLICT (scheduled_report_id, recipient_id) DO NOTHING
         RETURNING scheduled_report_id`,
        [newRecipient.id]
      );

      await pool.query("COMMIT");

      return NextResponse.json({
        recipient: newRecipient,
        message: "Recipient created successfully",
        addedToReports: associationResult.rows.length,
      });
    } catch (innerError) {
      await pool.query("ROLLBACK");
      throw innerError;
    }
  } catch (error: unknown) {
    console.error("Error creating recipient:", error);

    // Handle unique constraint violation
    if (error && typeof error === 'object' && 'code' in error && error.code === "23505") {
      return NextResponse.json(
        { error: "This email already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create recipient" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}

// PUT: Update a recipient
export async function PUT(request: NextRequest) {
  const pool = getSupabasePool();

  try {
    const body = await request.json();
    const { id, email, name, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Recipient ID is required" },
        { status: 400 }
      );
    }

    const result = await pool.query<Recipient>(
      `UPDATE report_recipients
       SET email = COALESCE($2, email),
           name = COALESCE($3, name),
           is_active = COALESCE($4, is_active)
       WHERE id = $1
       RETURNING id, email, name, organization_id, is_active, created_at, updated_at`,
      [id, email, name, is_active]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      recipient: result.rows[0],
      message: "Recipient updated successfully",
    });
  } catch (error: unknown) {
    console.error("Error updating recipient:", error);

    // Handle unique constraint violation
    if (error && typeof error === 'object' && 'code' in error && error.code === "23505") {
      return NextResponse.json(
        { error: "This email already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update recipient" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}

// DELETE: Remove a recipient
export async function DELETE(request: NextRequest) {
  const pool = getSupabasePool();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Recipient ID is required" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `DELETE FROM report_recipients WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Recipient deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting recipient:", error);
    return NextResponse.json(
      { error: "Failed to delete recipient" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
