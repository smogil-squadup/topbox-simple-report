"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Loader2, Clock, Calendar, CheckCircle, XCircle, AlertCircle, Play } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ScheduledReport {
  id: string;
  name: string;
  description: string | null;
  cron_expression: string;
  schedule_description: string | null;
  report_type: string;
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
  created_at: string;
}

// US Timezone mappings
const US_TIMEZONES = [
  { value: "America/Chicago", label: "Central Time (Texas)", offset: "UTC-6/-5" },
  { value: "America/New_York", label: "Eastern Time", offset: "UTC-5/-4" },
  { value: "America/Denver", label: "Mountain Time", offset: "UTC-7/-6" },
  { value: "America/Los_Angeles", label: "Pacific Time", offset: "UTC-8/-7" },
  { value: "America/Phoenix", label: "Arizona Time", offset: "UTC-7" },
  { value: "America/Anchorage", label: "Alaska Time", offset: "UTC-9/-8" },
  { value: "Pacific/Honolulu", label: "Hawaii Time", offset: "UTC-10" },
];

export default function SchedulePage() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ScheduledReport | null>(null);

  // Schedule settings
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [timezone, setTimezone] = useState("America/Chicago");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load reports
  const loadReports = async () => {
    setIsLoading(true);
    toast.loading("Loading scheduled reports...", { id: "load" });

    try {
      const response = await fetch("/api/scheduled-reports");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load reports");
      }

      setReports(data.reports || []);

      // Select the first report by default
      if (data.reports && data.reports.length > 0) {
        const defaultReport = data.reports[0];
        setSelectedReport(defaultReport);

        // Parse cron expression (format: "minute hour * * *")
        const cronParts = defaultReport.cron_expression.split(" ");
        if (cronParts.length >= 2) {
          setMinute(parseInt(cronParts[0]) || 0);
          setHour(parseInt(cronParts[1]) || 9);
        }

        setIsActive(defaultReport.is_active);
      }

      toast.dismiss("load");
      toast.success(`Loaded ${data.reports?.length || 0} scheduled report(s)`);
    } catch (error) {
      toast.dismiss("load");
      toast.error(error instanceof Error ? error.message : "Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  };

  // Save schedule settings
  const handleSave = async () => {
    if (!selectedReport) {
      toast.error("No report selected");
      return;
    }

    setIsSaving(true);
    toast.loading("Updating schedule...", { id: "save" });

    try {
      // Convert local time to UTC for cron
      // Cron runs in UTC, so we need to convert the user's selected time
      const date = new Date();
      date.setHours(hour, minute, 0, 0);

      // Get timezone offset
      const tzDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
      const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
      const offsetMs = utcDate.getTime() - tzDate.getTime();

      // Apply offset to get UTC time
      const utcTime = new Date(date.getTime() + offsetMs);
      const utcHour = utcTime.getUTCHours();
      const utcMinute = utcTime.getUTCMinutes();

      // Build cron expression (minute hour * * *)
      const cronExpression = `${utcMinute} ${utcHour} * * *`;

      // Build human-readable description
      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      const tzLabel = US_TIMEZONES.find((tz) => tz.value === timezone)?.label || timezone;
      const scheduleDescription = `Every day at ${timeStr} ${tzLabel}`;

      const response = await fetch("/api/scheduled-reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedReport.id,
          cron_expression: cronExpression,
          schedule_description: scheduleDescription,
          is_active: isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update schedule");
      }

      toast.dismiss("save");
      toast.success("Schedule updated successfully");
      loadReports();
    } catch (error) {
      toast.dismiss("save");
      toast.error(error instanceof Error ? error.message : "Failed to update schedule");
    } finally {
      setIsSaving(false);
    }
  };

  // Load reports on mount
  useEffect(() => {
    loadReports();
  }, []);

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "success":
        return <CheckCircle className="text-green-600" size={20} />;
      case "partial_success":
        return <AlertCircle className="text-yellow-600" size={20} />;
      case "error":
        return <XCircle className="text-red-600" size={20} />;
      case "no_recipients":
        return <AlertCircle className="text-orange-600" size={20} />;
      default:
        return <Clock className="text-gray-400" size={20} />;
    }
  };

  const getStatusText = (status: string | null) => {
    switch (status) {
      case "success":
        return "Success";
      case "partial_success":
        return "Partial Success";
      case "error":
        return "Error";
      case "no_recipients":
        return "No Recipients";
      default:
        return "Not Run";
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <Toaster position="top-right" />

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Report Schedule</h1>
        <p className="text-gray-600">Configure automated report delivery times and timezone</p>
      </div>

      {isLoading && reports.length === 0 ? (
        <div className="text-center py-12">
          <Loader2 className="animate-spin mx-auto mb-4" size={40} />
          <p className="text-gray-600">Loading scheduled reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-gray-600">No scheduled reports found</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Schedule Settings Card */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Schedule Settings</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Time Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Delivery Time</label>
                <div className="flex gap-2">
                  <select
                    value={hour}
                    onChange={(e) => setHour(parseInt(e.target.value))}
                    className="flex-1 p-3 border rounded-md"
                    disabled={isSaving}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i.toString().padStart(2, "0")}:00 {i < 12 ? "AM" : "PM"}
                      </option>
                    ))}
                  </select>
                  <select
                    value={minute}
                    onChange={(e) => setMinute(parseInt(e.target.value))}
                    className="w-24 p-3 border rounded-md"
                    disabled={isSaving}>
                    <option value={0}>:00</option>
                    <option value={15}>:15</option>
                    <option value={30}>:30</option>
                    <option value={45}>:45</option>
                  </select>
                </div>
              </div>

              {/* Timezone Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full p-3 border rounded-md"
                  disabled={isSaving}>
                  {US_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label} ({tz.offset})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="mt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={isSaving}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm font-medium">
                  Enable automatic reports
                </span>
              </label>
              <p className="text-sm text-gray-500 mt-1 ml-8">
                Reports will be sent daily at the scheduled time
              </p>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving || !selectedReport}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Saving...
                  </>
                ) : (
                  <>Save Schedule</>
                )}
              </button>
            </div>
          </Card>

          {/* Report Status Card */}
          {selectedReport && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Report Status</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Report Name</div>
                    <div className="font-medium">{selectedReport.name}</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600 mb-1">Current Schedule</div>
                    <div className="font-medium">
                      {selectedReport.schedule_description || "Not configured"}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600 mb-1">Status</div>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                      selectedReport.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {selectedReport.is_active ? "Active" : "Inactive"}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="text-sm text-gray-600 mb-2">Last Run</div>
                  {selectedReport.last_run_at ? (
                    <div className="flex items-center gap-3">
                      {getStatusIcon(selectedReport.last_run_status)}
                      <div>
                        <div className="font-medium">
                          {getStatusText(selectedReport.last_run_status)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {new Date(selectedReport.last_run_at).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                        {selectedReport.last_run_error && (
                          <div className="text-sm text-red-600 mt-1">
                            Error: {selectedReport.last_run_error}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">Never run</div>
                  )}
                </div>

                {selectedReport.description && (
                  <div className="border-t pt-4">
                    <div className="text-sm text-gray-600 mb-1">Description</div>
                    <div className="text-sm">{selectedReport.description}</div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Quick Info */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex gap-3">
              <Play className="text-blue-600 flex-shrink-0" size={20} />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-1">Testing in Trigger.dev</p>
                <p className="text-blue-700">
                  You can manually test this report anytime from your Trigger.dev dashboard.
                  Scheduled runs will happen automatically at the time you configure above.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
