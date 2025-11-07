import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getEventListReport } from "@/lib/db";

const HOST_USER_ID = 10111198;

const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function to generate CSV content
function generateCSV(
  results: Array<{
    eventId: number;
    eventName: string;
    payoutAmount: number;
    ticketsSold: number;
  }>
): string {
  // CSV Header
  let csv = "Event ID,Event Name,Payout Amount,Tickets Sold\n";

  // Data rows
  results.forEach((event) => {
    // Escape event names with commas or quotes
    const escapedName = event.eventName.includes(",")
      ? `"${event.eventName.replace(/"/g, '""')}"`
      : event.eventName;

    csv += `${event.eventId},${escapedName},${event.payoutAmount.toFixed(2)},${event.ticketsSold}\n`;
  });

  // Totals row
  const totalPayout = results.reduce((sum, e) => sum + e.payoutAmount, 0);
  const totalTickets = results.reduce((sum, e) => sum + e.ticketsSold, 0);
  csv += `\nTotal,,${totalPayout.toFixed(2)},${totalTickets}\n`;

  return csv;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, hostUserId } = body;

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Email is required",
        },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email address",
        },
        { status: 400 }
      );
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "Email service not configured",
        },
        { status: 500 }
      );
    }

    // Check if sender email is configured
    if (!process.env.RESEND_FROM_EMAIL) {
      return NextResponse.json(
        {
          success: false,
          error: "Sender email not configured",
        },
        { status: 500 }
      );
    }

    const targetHostUserId = hostUserId || HOST_USER_ID;

    console.log("Fetching event report for email:", { email, hostUserId: targetHostUserId });

    // Get the report data
    const results = await getEventListReport({
      hostUserId: targetHostUserId,
    });

    if (results.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No events found to send",
        },
        { status: 404 }
      );
    }

    // Generate CSV content
    const csvContent = generateCSV(results);
    const csvBase64 = Buffer.from(csvContent).toString("base64");

    // Calculate totals for email body
    const totalPayout = results.reduce((sum, e) => sum + e.payoutAmount, 0);
    const totalTickets = results.reduce((sum, e) => sum + e.ticketsSold, 0);

    // Generate filename with date
    const today = new Date().toISOString().split("T")[0];
    const filename = `event-report-${targetHostUserId}-${today}.csv`;

    // Send email with Resend
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject: `Event List Report - ${today}`,
      html: `
        <h2>Event List Report</h2>
        <p>Please find attached the event list report for host ID ${targetHostUserId}.</p>

        <h3>Summary</h3>
        <ul>
          <li><strong>Total Events:</strong> ${results.length}</li>
          <li><strong>Total Payout Amount:</strong> $${totalPayout.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
          <li><strong>Total Tickets Sold:</strong> ${totalTickets.toLocaleString()}</li>
        </ul>

        <p>The complete details are available in the attached CSV file.</p>

        <hr />
        <p style="color: #666; font-size: 12px;">Generated with Event Reporting Tool</p>
      `,
      attachments: [
        {
          filename: filename,
          content: csvBase64,
        },
      ],
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send email",
          details: process.env.NODE_ENV === "development" ? error.message : undefined,
        },
        { status: 500 }
      );
    }

    console.log("Email sent successfully:", data);

    return NextResponse.json({
      success: true,
      message: "Report sent successfully",
      emailId: data?.id,
    });
  } catch (error) {
    console.error("Send report error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to send report",
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
