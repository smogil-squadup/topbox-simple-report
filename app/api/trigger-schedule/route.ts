import { NextRequest, NextResponse } from "next/server";
import { schedules } from "@trigger.dev/sdk/v3";
import { dailyEventReport } from "@/src/trigger/daily-event-report";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cron, timezone, isActive } = body;

    if (!cron) {
      return NextResponse.json(
        { error: "Cron expression is required" },
        { status: 400 }
      );
    }

    // Use a consistent deduplication key
    const deduplicationKey = "daily-event-report-schedule";

    if (isActive) {
      // Create or update the schedule
      const schedule = await schedules.create({
        task: dailyEventReport.id,
        cron: cron,
        timezone: timezone || "America/New_York",
        deduplicationKey: deduplicationKey,
        externalId: deduplicationKey, // Use same ID for easy reference
      });

      return NextResponse.json({
        success: true,
        message: "Schedule created/updated successfully",
        schedule: {
          id: schedule.id,
          cron: cron,
          timezone: timezone,
        },
      });
    } else {
      // Delete the schedule if inactive
      try {
        await schedules.del(deduplicationKey);
        return NextResponse.json({
          success: true,
          message: "Schedule deleted successfully",
        });
      } catch (error) {
        // Schedule might not exist, that's okay
        return NextResponse.json({
          success: true,
          message: "Schedule already inactive",
        });
      }
    }
  } catch (error) {
    console.error("Error managing Trigger.dev schedule:", error);
    return NextResponse.json(
      {
        error: "Failed to manage schedule",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
