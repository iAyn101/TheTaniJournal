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

const fontFamilyMap = {
  serif: "'Georgia', serif",
  "sans-serif": "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  monospace: "'Monaco', 'Courier New', monospace",
};

const layoutStyleMap = {
  normal: "max-w-prose mx-auto",
  wide: "max-w-4xl mx-auto",
  columns: "grid grid-cols-2 gap-8 max-w-5xl mx-auto",
};

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
    explicit_content: false,
    audio_urls: ["", "", ""],
    video_urls: ["", "", ""],
    font_family: "serif",
    layout_style: "normal",
    background_color: "",
    background_image: "",
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
          explicit_content: data.explicit_content || false,
          audio_urls: [...(data.audio_urls || []), "", "", ""].slice(0, 3),
          video_urls: [...(data.video_urls || []), "", "", ""].slice(0, 3),
          font_family: data.font_family || "serif",
          layout_style: data.layout_style || "normal",
          background_color: data.background_color || "",
          background_image: data.background_image || "",
        });
      } catch {
        toast.error("Could not load post");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [postId, editing, navigate]);

  const uploadCoverImage = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post("/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((prev) => ({ ...prev, cover_image: data.url }));
      toast.success("Cover image uploaded");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    }
  };

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
        explicit_content: form.explicit_content,
        audio_urls: form.audio_urls.filter(Boolean),
        video_urls: form.video_urls.filter(Boolean),
        font_family: form.font_family,
        layout_style: form.layout_style,
        background_color: form.background_color.trim(),
        background_image: form.background_image.trim(),
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
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="editor-cover" className="text-xs uppercase tracking-[0.2em] text-stone-500">Cover image (URL or upload)</Label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => uploadCoverImage(e.target.files?.[0])}
              className="text-sm text-stone-500"
              data-testid="editor-cover-upload"
            />
          </div>
          <Input
            id="editor-cover"
            value={form.cover_image}
            onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
            placeholder="Cover image URL (optional)"
            className="border-0 px-0 placeholder:text-stone-400 focus-visible:ring-0 mt-3 bg-transparent text-sm"
            data-testid="editor-cover"
          />
          {form.cover_image && (
            <img src={form.cover_image} alt="cover preview" className="mt-4 mb-6 aspect-[16/9] object-cover rounded-md w-full" />
          )}
        </div>

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
            <div className="flex items-center gap-3 py-2">
              <Switch checked={form.explicit_content} onCheckedChange={(v) => setForm({ ...form, explicit_content: v })} data-testid="editor-explicit-toggle" id="explicit" />
              <Label htmlFor="explicit" className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-stone-500">
                Explicit content
              </Label>
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 mt-8">
          <div>
            <Label htmlFor="ed-font" className="text-xs uppercase tracking-[0.2em] text-stone-500 block mb-2">Font family</Label>
            <select
              id="ed-font"
              value={form.font_family}
              onChange={(e) => setForm({ ...form, font_family: e.target.value })}
              className="w-full rounded-md border border-stone-200 dark:border-stone-800 bg-transparent px-3 py-2 text-sm"
              data-testid="editor-font"
            >
              <option value="serif">Serif (Elegant)</option>
              <option value="sans-serif">Sans-serif (Modern)</option>
              <option value="monospace">Monospace (Code)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="ed-layout" className="text-xs uppercase tracking-[0.2em] text-stone-500 block mb-2">Layout style</Label>
            <select
              id="ed-layout"
              value={form.layout_style}
              onChange={(e) => setForm({ ...form, layout_style: e.target.value })}
              className="w-full rounded-md border border-stone-200 dark:border-stone-800 bg-transparent px-3 py-2 text-sm"
              data-testid="editor-layout"
            >
              <option value="normal">Normal (Center)</option>
              <option value="wide">Wide (Full width)</option>
              <option value="columns">Columns (2-column)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="ed-bg-color" className="text-xs uppercase tracking-[0.2em] text-stone-500 block mb-2">Background color</Label>
            <Input
              id="ed-bg-color"
              type="color"
              value={form.background_color}
              onChange={(e) => setForm({ ...form, background_color: e.target.value })}
              className="h-10 rounded-md cursor-pointer"
              data-testid="editor-bg-color"
            />
          </div>
          <div>
            <Label htmlFor="ed-bg-img" className="text-xs uppercase tracking-[0.2em] text-stone-500 block mb-2">Background image URL</Label>
            <Input
              id="ed-bg-img"
              value={form.background_image}
              onChange={(e) => setForm({ ...form, background_image: e.target.value })}
              placeholder="Background image URL (optional)"
              className="rounded-md bg-transparent border-stone-200 dark:border-stone-800"
              data-testid="editor-bg-img"
            />
          </div>
        </div>
        <div className="grid gap-4 mt-6">
          <div>
            <Label className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2">Audio URLs</Label>
            {form.audio_urls.map((url, index) => (
              <Input
                key={`audio-${index}`}
                value={url}
                onChange={(e) => {
                  const next = [...form.audio_urls];
                  next[index] = e.target.value;
                  setForm({ ...form, audio_urls: next });
                }}
                placeholder={index === 0 ? "Audio URL" : "Optional audio URL"}
                className="mt-2 rounded-md bg-transparent border-stone-200 dark:border-stone-800"
                data-testid={`editor-audio-${index}`}
              />
            ))}
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2">Video URLs</Label>
            {form.video_urls.map((url, index) => (
              <Input
                key={`video-${index}`}
                value={url}
                onChange={(e) => {
                  const next = [...form.video_urls];
                  next[index] = e.target.value;
                  setForm({ ...form, video_urls: next });
                }}
                placeholder={index === 0 ? "Video URL" : "Optional video URL"}
                className="mt-2 rounded-md bg-transparent border-stone-200 dark:border-stone-800"
                data-testid={`editor-video-${index}`}
              />
            ))}
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
