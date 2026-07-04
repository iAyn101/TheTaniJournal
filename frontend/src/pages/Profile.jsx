import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import Navbar from "@/components/Navbar";
import PresenceAvatar from "@/components/PresenceAvatar";
import PostCard from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

export default function Profile() {
  const { userId } = useParams();
  const { user: me, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", bio: "", picture: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [u, p] = await Promise.all([
          api.get(`/users/${userId}`),
          api.get(`/posts`, { params: { author_id: userId, limit: 50 } }),
        ]);
        if (!mounted) return;
        setProfile(u.data);
        setPosts(p.data.items);
        setForm({ name: u.data.name, bio: u.data.bio || "", picture: u.data.picture || "" });
      } finally { if (mounted) setLoading(false); }
    })();
    // Re-fetch every 30s to refresh presence
    const id = setInterval(async () => {
      try {
        const { data } = await api.get(`/users/${userId}`);
        if (mounted) setProfile(data);
      } catch { /* ignore */ }
    }, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, [userId]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/users/me", form);
      setProfile(data);
      if (setUser) setUser(data);
      setEditOpen(false);
      toast.success("Profile updated");
    } catch { toast.error("Failed to update"); }
    finally { setSaving(false); }
  };

  const connectDrive = async () => {
    try {
      const { data } = await api.get("/auth/google/url");
      window.location.href = data.url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to start Google Drive connect");
    }
  };

  const disconnectDrive = async () => {
    try {
      const { data } = await api.post("/auth/google/disconnect");
      setProfile(data.user);
      if (setUser) setUser(data.user);
      toast.success("Drive disconnected");
    } catch {
      toast.error("Failed to disconnect Drive");
    }
  };

  if (loading) return (
    <div className="min-h-screen"><Navbar /><div className="flex justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div></div>
  );
  if (!profile) return (
    <div className="min-h-screen"><Navbar /><div className="text-center py-32 text-stone-500">User not found.</div></div>
  );

  const isMe = me?.user_id === profile.user_id;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 lg:px-8 py-12 lg:py-20">
        <div className="flex flex-col md:flex-row items-start gap-8 mb-16" data-testid="profile-header">
          <PresenceAvatar user={profile} size="xl" />
          <div className="flex-1">
            <h1 className="font-serif text-4xl sm:text-5xl tracking-tight mb-2" data-testid="profile-name">{profile.name}</h1>
            <div className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-4 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${profile.is_online ? "bg-blue-500" : "bg-stone-800 dark:bg-stone-700"}`} />
              {profile.is_online ? "Online now" : "Offline"} · @{profile.email?.split("@")[0]}
            </div>
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed max-w-2xl whitespace-pre-wrap">{profile.bio || (isMe ? "Add a short bio to introduce yourself." : "")}</p>
            {isMe && (
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-md mt-5 border-stone-300 dark:border-stone-700" data-testid="profile-edit-btn">
                    <Pencil className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} /> Edit profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background">
                  <DialogHeader><DialogTitle className="font-serif text-2xl">Edit profile</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-stone-500">Name</label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2 rounded-md" data-testid="profile-name-input" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-stone-500">Avatar URL</label>
                      <Input value={form.picture} onChange={(e) => setForm({ ...form, picture: e.target.value })} className="mt-2 rounded-md" data-testid="profile-picture-input" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-stone-500">Bio</label>
                      <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="mt-2 rounded-md min-h-[120px]" data-testid="profile-bio-input" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-md">Cancel</Button>
                    <Button onClick={saveProfile} disabled={saving} className="rounded-md" data-testid="profile-save-btn">
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {isMe && (
              <div className="mt-4">
                <div className="text-sm text-stone-600 mb-2">Google Drive: {profile.drive_connected ? <span className="text-green-600">Connected</span> : <span className="text-stone-500">Not connected</span>}</div>
                {!profile.drive_connected ? (
                  <Button onClick={connectDrive} className="rounded-md" data-testid="drive-connect-btn">Connect Google Drive</Button>
                ) : (
                  <Button variant="outline" onClick={disconnectDrive} className="rounded-md" data-testid="drive-disconnect-btn">Disconnect Drive</Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 text-xs uppercase tracking-[0.3em] text-stone-500">Public entries · {posts.length}</div>
        {posts.length === 0 ? (
          <div className="border border-dashed border-stone-300 dark:border-stone-700 rounded-md p-12 text-center text-stone-500" data-testid="profile-empty">
            No public entries yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8" data-testid="profile-posts">
            {posts.map((p) => <PostCard key={p.post_id} post={p} />)}
          </div>
        )}
      </main>
    </div>
  );
}
