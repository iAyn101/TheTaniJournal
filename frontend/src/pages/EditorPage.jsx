import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import Navbar from "@/components/Navbar";
import RichTextEditor from "@/components/RichTextEditor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, Globe } from "lucide-react";

export default function EditorPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(postId);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    cover_image: "",
    tags: "",
    is_public: false,
  });

  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        const { data } = await api.get(`/posts/${postId}`);
        setForm({
          title: data.title,
          content: data.content,
          cover_image: data.cover_image || "",
          tags: (data.tags || []).join(", "),
          is_public: data.is_public,
        });
      } catch { toast.error("Could not load post"); navigate("/dashboard"); }
      finally { setLoading(false); }
    })();
  }, [postId, editing, navigate]);

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!form.content || form.content === "<p><br></p>") { toast.error("Write something first"); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content,
        cover_image: form.cover_image.trim(),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        is_public: form.is_public,
      };
      let res;
      if (editing) res = await api.put(`/posts/${postId}`, payload);
      else res = await api.post("/posts", payload);
      toast.success(editing ? "Updated" : "Published");
      navigate(`/post/${res.data.post_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="min-h-screen"><Navbar /><div className="flex justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div></div>;
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-12 lg:py-16">
        <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-3">{editing ? "Edit entry" : "New entry"}</div>
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Untitled"
          className="border-0 px-0 text-4xl sm:text-5xl font-serif placeholder:text-stone-400 focus-visible:ring-0 mb-3 h-auto py-2 bg-transparent"
          data-testid="editor-title"
          style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}
        />
        <Input
          value={form.cover_image}
          onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
          placeholder="Cover image URL (optional)"
          className="border-0 px-0 placeholder:text-stone-400 focus-visible:ring-0 mb-6 bg-transparent text-sm"
          data-testid="editor-cover"
        />
        {form.cover_image && (
          <img src={form.cover_image} alt="cover preview" className="mb-6 aspect-[16/9] object-cover rounded-md w-full" />
        )}

        <RichTextEditor value={form.content} onChange={(v) => setForm({ ...form, content: v })} />

        <div className="grid sm:grid-cols-2 gap-6 mt-8">
          <div>
            <Label htmlFor="ed-tags" className="text-xs uppercase tracking-[0.2em] text-stone-500">Tags (comma separated)</Label>
            <Input
              id="ed-tags"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="mornings, reflection, travel"
              className="mt-2 rounded-md bg-transparent border-stone-200 dark:border-stone-800"
              data-testid="editor-tags"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.2em] text-stone-500 block mb-2">Visibility</Label>
            <div className="flex items-center gap-3 py-2">
              <Switch checked={form.is_public} onCheckedChange={(v) => setForm({ ...form, is_public: v })} data-testid="editor-public-toggle" id="visibility" />
              <Label htmlFor="visibility" className="inline-flex items-center gap-1.5 cursor-pointer">
                {form.is_public ? <><Globe className="h-3.5 w-3.5" strokeWidth={1.5} /> Public</> : <><Lock className="h-3.5 w-3.5" strokeWidth={1.5} /> Private</>}
              </Label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-10 pt-6 border-t border-stone-200 dark:border-stone-800">
          <Button variant="outline" onClick={() => navigate(-1)} className="rounded-md border-stone-300 dark:border-stone-700" data-testid="editor-cancel">Cancel</Button>
          <Button onClick={save} disabled={saving} className="rounded-md" data-testid="editor-save">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? "Update" : "Publish"}
          </Button>
        </div>
      </main>
    </div>
  );
}
