import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PresenceAvatar from "@/components/PresenceAvatar";
import { toast } from "sonner";
import { Flag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

function timeAgo(d) {
  if (!d) return "";
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(d).toLocaleDateString();
}

export default function CommentSection({ postId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    const { data } = await api.get(`/posts/${postId}/comments`);
    setComments(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [postId]);

  const submit = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await api.post(`/posts/${postId}/comments`, { content: text.trim() });
      setText("");
      await load();
    } catch (e) {
      toast.error("Couldn't post comment");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this comment?")) return;
    try {
      await api.delete(`/comments/${id}`);
      await load();
    } catch { toast.error("Failed to delete"); }
  };

  const report = async (id) => {
    const reason = prompt("Reason for reporting this comment?");
    if (!reason) return;
    try {
      await api.post("/reports", { target_type: "comment", target_id: id, reason });
      toast.success("Report submitted");
    } catch { toast.error("Failed to report"); }
  };

  return (
    <section className="mt-16 pt-12 border-t border-stone-200 dark:border-stone-800" data-testid="comments-section">
      <h3 className="font-serif text-3xl mb-8">Comments · {comments.length}</h3>

      {user ? (
        <div className="mb-10 flex gap-4">
          <PresenceAvatar user={user} size="md" />
          <div className="flex-1">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Leave a thoughtful comment…"
              className="bg-transparent border-stone-200 dark:border-stone-800 min-h-[100px] resize-none rounded-md"
              data-testid="comment-input"
            />
            <div className="flex justify-end mt-3">
              <Button onClick={submit} disabled={posting || !text.trim()} data-testid="comment-submit" className="rounded-md">
                {posting ? "Posting…" : "Post comment"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-10 p-6 border border-dashed border-stone-300 dark:border-stone-700 rounded-md text-stone-500 text-sm">
          <Link to="/auth" className="underline">Sign in</Link> to join the conversation.
        </div>
      )}

      <div className="space-y-8">
        {comments.length === 0 && (
          <div className="text-sm text-stone-500" data-testid="comments-empty">Be the first to share your thoughts.</div>
        )}
        {comments.map((c) => (
          <div key={c.comment_id} className="flex gap-4" data-testid="comment-item">
            <Link to={`/profile/${c.author_id}`}><PresenceAvatar user={c.author} size="md" /></Link>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Link to={`/profile/${c.author_id}`} className="text-sm font-medium hover:underline">{c.author?.name}</Link>
                <span className="text-xs text-stone-500">{timeAgo(c.created_at)}</span>
              </div>
              <p className="text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">{c.content}</p>
              <div className="mt-2 flex items-center gap-3 text-xs">
                {user?.user_id === c.author_id && (
                  <button onClick={() => remove(c.comment_id)} className="text-stone-500 hover:text-destructive inline-flex items-center gap-1" data-testid="comment-delete">
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} /> Delete
                  </button>
                )}
                {user && user.user_id !== c.author_id && (
                  <button onClick={() => report(c.comment_id)} className="text-stone-500 hover:text-foreground inline-flex items-center gap-1" data-testid="comment-report">
                    <Flag className="h-3 w-3" strokeWidth={1.5} /> Report
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
