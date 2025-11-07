import { NextRequest, NextResponse } from "next/server";
import { getEventListReport } from "@/lib/db";

const HOST_USER_ID = 10111198;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hostUserId } = body;

    // Use provided hostUserId or default to HOST_USER_ID
    const targetHostUserId = hostUserId || HOST_USER_ID;

    console.log('Event list report request:', { hostUserId: targetHostUserId });

    // Query the database for event list report for the host user
    console.log('Executing database query...');
    const results = await getEventListReport({
      hostUserId: targetHostUserId,
    });

    console.log('Query successful, found results:', results.length);

    return NextResponse.json({
      results,
      metadata: {
        hostUserId: targetHostUserId,
        total: results.length,
      },
    });
  } catch (error) {
    console.error("Event list report error details:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');

    // Check if it's a connection error
    if (error instanceof Error && error.message.includes("connect")) {
      return NextResponse.json(
        {
          error:
            "Database connection failed. Please check your credentials and try again.",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch event list report",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : "Unknown error"
            : undefined,
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing connection
export async function GET() {
  try {
    const { query } = await import("@/lib/db");

    // Simple test query
    const result = await query(
      "SELECT NOW() as current_time, current_database() as database"
    );

    const firstRow = result[0] as { database: string; current_time: string };

    return NextResponse.json({
      status: "connected",
      database: firstRow.database,
      serverTime: firstRow.current_time,
      hostUserId: HOST_USER_ID,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: "Database connection failed",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : "Unknown error"
            : undefined,
      },
      { status: 503 }
    );
  }
}
