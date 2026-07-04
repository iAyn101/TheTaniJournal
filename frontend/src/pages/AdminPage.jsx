import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [resolving, setResolving] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [usersRes, reportsRes] = await Promise.all([
          api.get("/admin/users"),
          api.get("/admin/reports"),
        ]);
        if (!mounted) return;
        setUsers(usersRes.data || []);
        setReports(reportsRes.data || []);
      } catch (err) {
        setError(err?.response?.data?.detail || "Could not load admin data");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (user?.is_admin) {
      load();
    } else {
      setLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, [user]);

  const resolveReport = async (reportId) => {
    setResolving(reportId);
    try {
      await api.post(`/admin/reports/${reportId}/resolve`);
      setReports((current) => current.map((report) => report.report_id === reportId ? { ...report, status: "resolved" } : report));
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "Failed to resolve report");
    } finally {
      setResolving(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-32 text-stone-500">Loading…</div>
      </div>
    );
  }

  if (!user.is_admin) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-3xl mx-auto px-6 py-24 text-center text-stone-600">
          <h1 className="text-3xl font-serif mb-4">Admin access required</h1>
          <p>Only administrators can view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
        <div className="mb-10">
          <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-3">Admin dashboard</div>
          <h1 className="font-serif text-4xl">Manage users and reports</h1>
          <p className="text-stone-600 mt-3">Review community reports, resolve issues, and inspect active users.</p>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive mb-8">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>
        ) : (
          <div className="space-y-12">
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold">Users</h2>
                  <p className="text-sm text-stone-500">{users.length} registered users</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Drive</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((profile) => (
                    <TableRow key={profile.user_id}>
                      <TableCell>{profile.name}</TableCell>
                      <TableCell>{profile.email}</TableCell>
                      <TableCell>{profile.is_admin ? "Admin" : "Member"}</TableCell>
                      <TableCell>{profile.drive_connected ? "Connected" : "Not connected"}</TableCell>
                      <TableCell>{formatDate(profile.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold">Reports</h2>
                  <p className="text-sm text-stone-500">{reports.length} total reports</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.report_id}>
                      <TableCell>{report.target_type}</TableCell>
                      <TableCell>{report.target_id}</TableCell>
                      <TableCell>{report.reporter_id}</TableCell>
                      <TableCell className="max-w-xs truncate">{report.reason}</TableCell>
                      <TableCell>{report.status}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={report.status === "resolved" ? "outline" : "default"}
                          onClick={() => resolveReport(report.report_id)}
                          disabled={report.status === "resolved" || resolving === report.report_id}
                        >
                          {report.status === "resolved" ? "Resolved" : resolving === report.report_id ? "Resolving…" : "Resolve"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}