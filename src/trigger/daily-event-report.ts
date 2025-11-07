import { schedules } from "@trigger.dev/sdk/v3";
import { Pool } from "pg";
import { Resend } from "resend";

interface EventListResult {
  eventId: number;
  eventName: string;
  payoutAmount: number;
  ticketsSold: number;
}

interface Recipient {
  email: string;
  name: string | null;
}

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function to generate CSV content
function generateCSV(results: EventListResult[]): string {
  // CSV Header
  let csv = "Event ID,Event Name,Payout Amount,Tickets Sold\n";

  // Data rows
  results.forEach((event) => {
    // Escape event names with commas or quotes
    const escapedName = event.eventName.includes(",")
      ? `"${event.eventName.replace(/"/g, '""')}"`
      : event.eventName;

    // Convert to numbers to handle database string/decimal types
    const payoutAmount = Number(event.payoutAmount);
    const ticketsSold = Number(event.ticketsSold);

    csv += `${event.eventId},${escapedName},${payoutAmount.toFixed(2)},${ticketsSold}\n`;
  });

  // Totals row
  const totalPayout = results.reduce((sum, e) => sum + Number(e.payoutAmount), 0);
  const totalTickets = results.reduce((sum, e) => sum + Number(e.ticketsSold), 0);
  csv += `\nTotal,,${totalPayout.toFixed(2)},${totalTickets}\n`;

  return csv;
}

export const dailyEventReport = schedules.task({
  id: "daily-event-report",
  // Schedule will be managed dynamically via the UI
  run: async (payload, { ctx }) => {
    console.log("Starting daily event report job", { payload });

    // Connect to Supabase to get recipients
    const supabasePool = new Pool({
      connectionString: process.env.SUPABASE_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });

    // Connect to CrunchyBridge to get event data
    const crunchyPool = new Pool({
      connectionString: process.env.CRUNCHYBRIDGE_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });

    try {
      // 1. Fetch the default scheduled report
      const scheduledReportResult = await supabasePool.query(`
        SELECT id, name, description
        FROM scheduled_reports
        WHERE is_active = true
          AND name = 'Daily Event Report'
        LIMIT 1
      `);

      if (scheduledReportResult.rows.length === 0) {
        console.log("No active scheduled report found");
        return {
          success: false,
          message: "No active scheduled report found",
        };
      }

      const scheduledReport = scheduledReportResult.rows[0];
      console.log("Found scheduled report:", scheduledReport.name);

      // 2. Fetch active recipients for this report
      const recipientsResult = await supabasePool.query<Recipient>(`
        SELECT rr.email, rr.name
        FROM scheduled_report_recipients srr
        JOIN report_recipients rr ON srr.recipient_id = rr.id
        WHERE srr.scheduled_report_id = $1
          AND rr.is_active = true
        ORDER BY rr.email
      `, [scheduledReport.id]);

      const recipients = recipientsResult.rows;
      console.log(`Found ${recipients.length} active recipients`);

      if (recipients.length === 0) {
        console.log("No active recipients found for this report");

        // Update last run status
        await supabasePool.query(`
          UPDATE scheduled_reports
          SET last_run_at = NOW(),
              last_run_status = 'no_recipients',
              last_run_error = 'No active recipients found'
          WHERE id = $1
        `, [scheduledReport.id]);

        return {
          success: false,
          message: "No active recipients found",
        };
      }

      // 3. Fetch event list report data
      // Using the same query from getEventListReport in lib/db.ts
      const eventsResult = await crunchyPool.query<EventListResult>(`
        SELECT
          e.id AS "eventId",
          e.name AS "eventName",
          COALESCE(payout_sum.total_payout, 0) AS "payoutAmount",
          COALESCE(tickets_sum.total_tickets, 0) AS "ticketsSold"
        FROM
          events e
        LEFT JOIN (
          SELECT
            p.event_id,
            ROUND(SUM(
              p.amount - p.refund_amount - p.guest_processing_fees - p.host_processing_fees -
              p.guest_squadup_fees - p.host_squadup_fees - p.insurance_premium - p.shipping_fees
            ), 2) as total_payout
          FROM payments p
          WHERE p.status NOT IN ('void', 'refund', 'cancel', 'transfer')
            AND (p.payment_plan_in_progress IS NULL OR p.payment_plan_in_progress = false)
            AND (p.payment_instrument != 'check_wire' OR (p.payment_instrument = 'check_wire' AND p.check_wire_paid_at IS NOT NULL))
          GROUP BY p.event_id
        ) payout_sum ON payout_sum.event_id = e.id
        LEFT JOIN (
          SELECT
            pt.event_id,
            SUM(COALESCE(pt.package_quantity, 1) * (pt.quantity_sold - pt.quantity_exchanged_sent)) as total_tickets
          FROM price_tiers pt
          GROUP BY pt.event_id
        ) tickets_sum ON tickets_sum.event_id = e.id
        WHERE
          e.user_id = 10111198
        ORDER BY
          e.name
      `);

      const events = eventsResult.rows;
      console.log(`Found ${events.length} events`);

      // 4. Send email to each recipient
      const emailsSent: string[] = [];
      const emailsFailed: string[] = [];

      // Generate CSV content once for all recipients
      const csvContent = generateCSV(events);
      const csvBase64 = Buffer.from(csvContent).toString("base64");

      // Calculate totals for email body (convert to numbers for calculation)
      const totalPayout = events.reduce((sum, e) => sum + Number(e.payoutAmount), 0);
      const totalTickets = events.reduce((sum, e) => sum + Number(e.ticketsSold), 0);

      // Generate filename with date
      const today = new Date().toISOString().split("T")[0];
      const filename = `event-report-${today}.csv`;

      for (const recipient of recipients) {
        try {
          console.log(`Sending report to ${recipient.email}`);

          // Send email directly using Resend
          const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL!,
            to: recipient.email,
            subject: `Event List Report - ${today}`,
            html: `
              <h2>Event List Report</h2>
              <p>Hi${recipient.name ? ` ${recipient.name}` : ""},</p>
              <p>Please find attached your daily event list report.</p>

              <h3>Summary</h3>
              <ul>
                <li><strong>Total Events:</strong> ${events.length}</li>
                <li><strong>Total Payout Amount:</strong> $${totalPayout.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
                <li><strong>Total Tickets Sold:</strong> ${totalTickets.toLocaleString()}</li>
              </ul>

              <p>The complete details are available in the attached CSV file.</p>

              <hr />
              <p style="color: #666; font-size: 12px;">
                Generated automatically by Event Reporting Tool<br/>
                Report Date: ${today}
              </p>
            `,
            attachments: [
              {
                filename: filename,
                content: csvBase64,
              },
            ],
          });

          if (error) {
            throw new Error(error.message || "Failed to send email");
          }

          emailsSent.push(recipient.email);
          console.log(`Successfully sent report to ${recipient.email}`, { emailId: data?.id });
        } catch (error) {
          console.error(`Failed to send email to ${recipient.email}:`, error);
          emailsFailed.push(recipient.email);
        }
      }

      // 5. Update scheduled report status
      const status = emailsFailed.length === 0 ? "success" : "partial_success";
      const errorMessage = emailsFailed.length > 0
        ? `Failed to send to: ${emailsFailed.join(", ")}`
        : null;

      await supabasePool.query(`
        UPDATE scheduled_reports
        SET last_run_at = NOW(),
            last_run_status = $2,
            last_run_error = $3
        WHERE id = $1
      `, [scheduledReport.id, status, errorMessage]);

      console.log("Daily event report job completed", {
        emailsSent: emailsSent.length,
        emailsFailed: emailsFailed.length,
      });

      return {
        success: true,
        emailsSent: emailsSent.length,
        emailsFailed: emailsFailed.length,
        recipients: emailsSent,
        errors: emailsFailed.length > 0 ? emailsFailed : undefined,
      };
    } catch (error) {
      console.error("Daily event report job failed:", error);

      // Update scheduled report with error
      try {
        await supabasePool.query(`
          UPDATE scheduled_reports
          SET last_run_at = NOW(),
              last_run_status = 'error',
              last_run_error = $1
          WHERE name = 'Daily Event Report'
        `, [error instanceof Error ? error.message : String(error)]);
      } catch (updateError) {
        console.error("Failed to update error status:", updateError);
      }

      throw error;
    } finally {
      await supabasePool.end();
      await crunchyPool.end();
    }
  },
});
