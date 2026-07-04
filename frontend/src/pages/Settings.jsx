import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Settings() {
  const { user: me, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/users/${me.user_id}`);
        if (mounted) setProfile(data);
      } catch (e) {
        toast.error("Could not load settings");
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [me]);

  const connectDrive = async () => {
    try {
      const { data } = await api.get("/auth/google/url");
      window.location.href = data.url;
    } catch (e) {
      toast.error("Failed to start Drive connect");
    }
  };

  const reconnectDrive = async () => {
    try {
      const { data } = await api.get("/auth/google/reconnect_url");
      window.location.href = data.url;
    } catch (e) {
      toast.error("Failed to build reconnect URL");
    }
  };

  const sendReconnectEmail = async () => {
    setSending(true);
    try {
      await api.post("/auth/google/request_refresh_email");
      toast.success("Reconnect email sent");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to send email");
    } finally { setSending(false); }
  };

  const disconnectDrive = async () => {
    try {
      const { data } = await api.post("/auth/google/disconnect");
      setProfile(data.user);
      if (setUser) setUser(data.user);
      toast.success("Drive disconnected");
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  if (loading) return (<div className="min-h-screen"><Navbar /><div className="flex justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div></div>);
  if (!profile) return (<div className="min-h-screen"><Navbar /><div className="text-center py-32 text-stone-500">Settings not available.</div></div>);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-12 lg:py-16">
        <h2 className="font-serif text-2xl mb-4">Account settings</h2>
        <div className="mb-6">
          <div className="text-sm text-stone-600 mb-2">Google Drive backup</div>
          <div className="mb-4">Status: {profile.drive_connected ? <span className="text-green-600">Connected</span> : <span className="text-stone-500">Not connected</span>}</div>
          {!profile.drive_connected ? (
            <div className="flex gap-3">
              <Button onClick={connectDrive}>Connect Drive</Button>
              <Button variant="outline" onClick={sendReconnectEmail} disabled={sending}>{sending ? "Sending..." : "Email me reconnect link"}</Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button onClick={reconnectDrive}>Re-request refresh token</Button>
              <Button variant="outline" onClick={disconnectDrive}>Disconnect Drive</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
