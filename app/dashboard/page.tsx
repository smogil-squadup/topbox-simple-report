"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Loader2, RefreshCw, Mail, Search, Calendar as CalendarIcon } from "lucide-react";
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
  const [filteredResults, setFilteredResults] = useState<EventListResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadEventReport = async () => {
    setIsLoading(true);
    setResults([]);
    setFilteredResults([]);

    toast.loading("Loading event report...", { id: "load" });

    try {
      const body: { dateFrom?: string; dateTo?: string } = {};

      if (dateFrom) {
        body.dateFrom = dateFrom;
      }

      if (dateTo) {
        body.dateTo = dateTo;
      }

      const response = await fetch("/api/seat-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load report");
      }

      setResults(data.results || []);
      setFilteredResults(data.results || []);

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
      // Build filter information to include in the email
      const filters: { searchQuery?: string; dateFrom?: string; dateTo?: string } = {};
      if (searchQuery) filters.searchQuery = searchQuery;
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;

      const response = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          results: filteredResults, // Send the filtered results
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        }),
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

  // Filter results by search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredResults(results);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = results.filter((event) =>
        event.eventName.toLowerCase().includes(query) ||
        event.eventId.toString().includes(query)
      );
      setFilteredResults(filtered);
    }
  }, [searchQuery, results]);

  // Load report on mount
  useEffect(() => {
    loadEventReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              disabled={isLoading || filteredResults.length === 0}
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

        {/* Filters */}
        <div className="mt-6 p-4 bg-white border rounded-lg shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search Filter */}
            <div className="flex flex-col">
              <label htmlFor="search" className="text-sm font-medium mb-2">
                Search Events
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by event name or ID..."
                  className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Date From Filter */}
            <div className="flex flex-col">
              <label htmlFor="dateFrom" className="text-sm font-medium mb-2">
                Start Date
              </label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Date To Filter */}
            <div className="flex flex-col">
              <label htmlFor="dateTo" className="text-sm font-medium mb-2">
                End Date
              </label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="mt-4 flex gap-2 justify-end">
            <button
              onClick={async () => {
                setSearchQuery("");
                setDateFrom("");
                setDateTo("");

                // Reload data without filters
                setIsLoading(true);
                setResults([]);
                setFilteredResults([]);
                toast.loading("Clearing filters...", { id: "clear" });

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
                  setFilteredResults(data.results || []);

                  toast.dismiss("clear");
                  toast.success("Filters cleared");
                } catch (error) {
                  toast.dismiss("clear");
                  toast.error(error instanceof Error ? error.message : "Failed to clear filters");
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors">
              Clear Filters
            </button>
            <button
              onClick={loadEventReport}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
              Apply Date Filter
            </button>
          </div>
        </div>
      </div>

      {/* Send Report Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Report via Email</DialogTitle>
            <DialogDescription>
              Enter an email address to receive the event report as a CSV attachment.
              {(searchQuery || dateFrom || dateTo) && (
                <span className="block mt-2 text-blue-600 font-medium">
                  Note: The report will include only the {filteredResults.length} filtered event(s) currently displayed.
                </span>
              )}
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
        {isLoading && filteredResults.length === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto mb-4" size={40} />
            <p className="text-gray-600">Loading event report...</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {results.length === 0 ? "No events found" : "No events match your search"}
            </p>
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
                {filteredResults.map((event, idx) => (
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
                    Total ({filteredResults.length} events)
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                    ${filteredResults.reduce((sum, e) => sum + e.payoutAmount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                    {filteredResults.reduce((sum, e) => sum + e.ticketsSold, 0).toLocaleString()}
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
