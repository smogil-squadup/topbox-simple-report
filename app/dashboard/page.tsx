"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Loader2, RefreshCw, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EventListResult {
  eventId: number;
  eventName: string;
  payoutAmount: number;
  ticketsSold: number;
}

export default function Home() {
  const [results, setResults] = useState<EventListResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const loadEventReport = async () => {
    setIsLoading(true);
    setResults([]);

    toast.loading("Loading event report...", { id: "load" });

    try {
      const response = await fetch("/api/seat-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load report");
      }

      setResults(data.results || []);

      toast.dismiss("load");
      toast.success(`Loaded ${data.results?.length || 0} event(s)`);
    } catch (error) {
      toast.dismiss("load");
      toast.error(error instanceof Error ? error.message : "Failed to load report");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReport = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setIsSending(true);
    toast.loading("Sending report...", { id: "send" });

    try {
      const response = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send report");
      }

      toast.dismiss("send");
      toast.success(`Report sent to ${email}`);
      setIsDialogOpen(false);
      setEmail("");
    } catch (error) {
      toast.dismiss("send");
      toast.error(error instanceof Error ? error.message : "Failed to send report");
    } finally {
      setIsSending(false);
    }
  };

  // Load report on mount
  useEffect(() => {
    loadEventReport();
  }, []);


  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <Toaster position="top-right" />

      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Event List Report</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setIsDialogOpen(true)}
              disabled={isLoading || results.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              <Mail size={18} />
              Send Report
            </button>
            <button
              onClick={loadEventReport}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  Refresh
                </>
              )}
            </button>
          </div>
        </div>
        <p className="text-gray-600">
          Event summary showing payout amounts and ticket sales
        </p>
      </div>

      {/* Send Report Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Report via Email</DialogTitle>
            <DialogDescription>
              Enter an email address to receive the event report as a CSV attachment.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              className="w-full p-3 border rounded-md"
              disabled={isSending}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSendReport();
                }
              }}
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsDialogOpen(false)}
              disabled={isSending}
              className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSendReport}
              disabled={isSending || !email.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              {isSending ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Sending...
                </>
              ) : (
                <>
                  <Mail size={18} />
                  Send Report
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        {isLoading && results.length === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto mb-4" size={40} />
            <p className="text-gray-600">Loading event report...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No events found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Event ID
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Event Name
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    Payout Amount
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    Tickets Sold
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((event, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <a
                        href={`https://squadup.com/${event.eventId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                        {event.eventId}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {event.eventName}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                      ${event.payoutAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      {event.ticketsSold.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900" colSpan={2}>
                    Total
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                    ${results.reduce((sum, e) => sum + e.payoutAmount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                    {results.reduce((sum, e) => sum + e.ticketsSold, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
