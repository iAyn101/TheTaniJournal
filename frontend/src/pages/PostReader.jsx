import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import Navbar from "@/components/Navbar";
import CommentSection from "@/components/CommentSection";
import PresenceAvatar from "@/components/PresenceAvatar";
import { Button } from "@/components/ui/button";
import { Flag, Pencil, Trash2, Lock, Globe, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default function PostReader() {
  const { postId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/posts/${postId}`);
        if (mounted) setPost(data);
      } catch {
        if (mounted) setNotFound(true);
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [postId]);

  const handleDelete = async () => {
    if (!confirm("Delete this entry?")) return;
    try {
      await api.delete(`/posts/${postId}`);
      toast.success("Entry deleted");
      navigate("/dashboard");
    } catch { toast.error("Failed to delete"); }
  };

  const handleReport = async () => {
    const reason = prompt("Reason for reporting this post?");
    if (!reason) return;
    try {
      await api.post("/reports", { target_type: "post", target_id: postId, reason });
      toast.success("Report submitted");
    } catch { toast.error("Failed to report"); }
  };

  if (loading) return (
    <div className="min-h-screen"><Navbar />
      <div className="flex justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>
    </div>
  );
  if (notFound || !post) return (
    <div className="min-h-screen"><Navbar />
      <div className="max-w-prose mx-auto py-32 text-center">
        <h1 className="font-serif text-4xl mb-4">Not found</h1>
        <p className="text-stone-500 mb-6">This entry may be private or has been removed.</p>
        <Link to="/discover"><Button variant="outline" className="rounded-md">Back to discover</Button></Link>
      </div>
    </div>
  );

  const isAuthor = user?.user_id === post.author_id;

  return (
    <div className="min-h-screen">
      <Navbar />
      <article className="max-w-prose mx-auto px-6 py-12 md:py-20" data-testid="post-reader">
        <div className="flex items-center gap-2 mb-6 text-xs uppercase tracking-[0.3em] text-stone-500">
          <span>{formatDate(post.created_at)}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            {post.is_public ? <><Globe className="h-3 w-3" strokeWidth={1.5} /> Public</> : <><Lock className="h-3 w-3" strokeWidth={1.5} /> Private</>}
          </span>
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.1] tracking-tight mb-8" data-testid="post-title">{post.title}</h1>

        <div className="flex items-center justify-between mb-12 pb-6 border-b border-stone-200 dark:border-stone-800">
          <Link to={`/profile/${post.author_id}`} className="flex items-center gap-3 group">
            <PresenceAvatar user={post.author} size="md" />
            <div>
              <div className="text-sm font-medium group-hover:text-stone-500 transition-colors">{post.author?.name}</div>
              <div className="text-xs text-stone-500">{post.author?.is_online ? "Online now" : "Offline"}</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {isAuthor ? (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate(`/editor/${postId}`)} className="rounded-md border-stone-300 dark:border-stone-700" data-testid="post-edit">
                  <Pencil className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={handleDelete} className="rounded-md border-stone-300 dark:border-stone-700 hover:text-destructive" data-testid="post-delete">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} /> Delete
                </Button>
              </>
            ) : user ? (
              <Button variant="ghost" size="sm" onClick={handleReport} className="text-stone-500 hover:text-foreground" data-testid="post-report">
                <Flag className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} /> Report
              </Button>
            ) : null}
          </div>
        </div>

        {post.cover_image && (
          <img src={post.cover_image} alt={post.title} className="w-full rounded-md mb-10 aspect-[16/9] object-cover" />
        )}

        <div className="prose-journal" data-testid="post-content" dangerouslySetInnerHTML={{ __html: post.content }} />

        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-stone-200 dark:border-stone-800">
            {post.tags.map((t) => (
              <Link to={`/discover`} key={t} className="px-3 py-1 rounded-sm text-[11px] font-mono uppercase tracking-wider bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 hover:bg-stone-200">
                {t}
              </Link>
            ))}
          </div>
        )}

        <CommentSection postId={postId} />
      </article>
    </div>
  );
}
