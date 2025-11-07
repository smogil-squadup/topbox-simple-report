"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Loader2, Plus, Pencil, Trash2, Mail, UserCheck, UserX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

interface Recipient {
  id: string;
  email: string;
  name: string | null;
  organization_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function RecipientsPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  // Load recipients
  const loadRecipients = async () => {
    setIsLoading(true);
    toast.loading("Loading recipients...", { id: "load" });

    try {
      const response = await fetch("/api/recipients");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load recipients");
      }

      setRecipients(data.recipients || []);
      toast.dismiss("load");
      toast.success(`Loaded ${data.recipients?.length || 0} recipient(s)`);
    } catch (error) {
      toast.dismiss("load");
      toast.error(error instanceof Error ? error.message : "Failed to load recipients");
    } finally {
      setIsLoading(false);
    }
  };

  // Create or update recipient
  const handleSave = async () => {
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return;
    }

    setIsSaving(true);
    toast.loading(editingRecipient ? "Updating recipient..." : "Creating recipient...", { id: "save" });

    try {
      const method = editingRecipient ? "PUT" : "POST";
      const body = editingRecipient
        ? { id: editingRecipient.id, ...formData }
        : formData;

      const response = await fetch("/api/recipients", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${editingRecipient ? "update" : "create"} recipient`);
      }

      toast.dismiss("save");
      toast.success(data.message || "Recipient saved successfully");

      setIsDialogOpen(false);
      setEditingRecipient(null);
      setFormData({ email: "", name: "" });
      loadRecipients();
    } catch (error) {
      toast.dismiss("save");
      toast.error(error instanceof Error ? error.message : "Failed to save recipient");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete recipient
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recipient?")) {
      return;
    }

    toast.loading("Deleting recipient...", { id: "delete" });

    try {
      const response = await fetch(`/api/recipients?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete recipient");
      }

      toast.dismiss("delete");
      toast.success("Recipient deleted successfully");
      loadRecipients();
    } catch (error) {
      toast.dismiss("delete");
      toast.error(error instanceof Error ? error.message : "Failed to delete recipient");
    }
  };

  // Toggle active status
  const handleToggleActive = async (recipient: Recipient) => {
    toast.loading("Updating status...", { id: "toggle" });

    try {
      const response = await fetch("/api/recipients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: recipient.id,
          is_active: !recipient.is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      toast.dismiss("toggle");
      toast.success(data.message || "Status updated successfully");
      loadRecipients();
    } catch (error) {
      toast.dismiss("toggle");
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  // Open edit dialog
  const handleEdit = (recipient: Recipient) => {
    setEditingRecipient(recipient);
    setFormData({
      email: recipient.email,
      name: recipient.name || "",
    });
    setIsDialogOpen(true);
  };

  // Open create dialog
  const handleCreate = () => {
    setEditingRecipient(null);
    setFormData({ email: "", name: "" });
    setIsDialogOpen(true);
  };

  // Load recipients on mount
  useEffect(() => {
    loadRecipients();
  }, []);

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <Toaster position="top-right" />

      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold">Report Recipients</h1>
            <p className="text-gray-600 mt-1">
              Manage email recipients for automated event reports
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Plus size={18} />
            Add Recipient
          </button>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRecipient ? "Edit Recipient" : "Add New Recipient"}
            </DialogTitle>
            <DialogDescription>
              {editingRecipient
                ? "Update recipient information"
                : "Add a new email recipient for automated reports"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="recipient@example.com"
                className="w-full p-3 border rounded-md"
                disabled={isSaving}
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Name (Optional)
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Recipient Name"
                className="w-full p-3 border rounded-md"
                disabled={isSaving}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !formData.email.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Saving...
                </>
              ) : (
                <>Save</>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipients List */}
      <Card className="overflow-hidden">
        {isLoading && recipients.length === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto mb-4" size={40} />
            <p className="text-gray-600">Loading recipients...</p>
          </div>
        ) : recipients.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-600 mb-4">No recipients yet</p>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
              <Plus size={18} />
              Add Your First Recipient
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Name
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Added
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recipients.map((recipient) => (
                  <tr key={recipient.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-gray-400" />
                        {recipient.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {recipient.name || "-"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleActive(recipient)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          recipient.is_active
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                        }`}>
                        {recipient.is_active ? (
                          <>
                            <UserCheck size={14} />
                            Active
                          </>
                        ) : (
                          <>
                            <UserX size={14} />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(recipient.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(recipient)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Edit">
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(recipient.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Summary Card */}
      {recipients.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="text-sm text-gray-600 mb-1">Total Recipients</div>
            <div className="text-3xl font-bold">{recipients.length}</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-600 mb-1">Active</div>
            <div className="text-3xl font-bold text-green-600">
              {recipients.filter((r) => r.is_active).length}
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-600 mb-1">Inactive</div>
            <div className="text-3xl font-bold text-gray-400">
              {recipients.filter((r) => !r.is_active).length}
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
