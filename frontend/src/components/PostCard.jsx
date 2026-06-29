import { Link } from "react-router-dom";
import PresenceAvatar from "@/components/PresenceAvatar";
import { MessageSquare, Lock } from "lucide-react";

function stripHtml(html = "") {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function PostCard({ post, showPrivate = false }) {
  const preview = post.excerpt || stripHtml(post.content).slice(0, 180);
  return (
    <Link
      to={`/post/${post.post_id}`}
      data-testid="post-card"
      className="group block border border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-600 rounded-md p-6 lg:p-8 bg-card transition-all duration-300 hover:-translate-y-1"
    >
      {post.cover_image && (
        <div className="mb-5 aspect-[16/10] overflow-hidden rounded-sm">
          <img src={post.cover_image} alt={post.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        </div>
      )}
      <div className="flex items-center gap-2 mb-4 text-xs uppercase tracking-[0.2em] text-stone-500">
        <span>{formatDate(post.created_at)}</span>
        {showPrivate && !post.is_public && (
          <span className="inline-flex items-center gap-1 text-stone-500" data-testid="badge-private">
            <Lock className="h-3 w-3" strokeWidth={1.5} /> Private
          </span>
        )}
      </div>
      <h3 className="font-serif text-2xl sm:text-3xl leading-tight mb-3 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors">
        {post.title}
      </h3>
      <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400 line-clamp-3 mb-5">{preview}</p>
      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {post.tags.slice(0, 4).map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-4 border-t border-stone-200/60 dark:border-stone-800/60">
        <div className="flex items-center gap-3">
          <PresenceAvatar user={post.author} size="sm" />
          <div className="text-sm">
            <div className="font-medium">{post.author?.name}</div>
            <div className="text-xs text-stone-500">@{post.author?.email?.split("@")[0]}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-stone-500">
          <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
          {post.comment_count || 0}
        </div>
      </div>
    </Link>
  );
}
