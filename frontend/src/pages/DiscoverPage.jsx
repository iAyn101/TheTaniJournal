import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

const emptyImg = "https://images.unsplash.com/photo-1586380951230-e6703d9f6833?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwxfHx3cml0aW5nJTIwam91cm5hbCUyMGFlc3RoZXRpY3xlbnwwfHx8fDE3ODI3NTc2Nzh8MA&ixlib=rb-4.1.0&q=85";

export default function DiscoverPage() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState(null);
  const [tags, setTags] = useState([]);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 12;

  const fetchPopularTags = useCallback(async () => {
    try {
      const { data } = await api.get("/posts/tags/popular");
      setTags(data);
    } catch { /* ignore */ }
  }, []);

  const fetchPosts = useCallback(async (opts = {}) => {
    setLoading(true);
    try {
      const params = { page: opts.page ?? page, limit };
      if (q) params.q = q;
      if (tag) params.tag = tag;
      const { data } = await api.get("/posts", { params });
      if (opts.append) setItems((prev) => [...prev, ...data.items]);
      else setItems(data.items);
      setTotal(data.total);
    } finally { setLoading(false); }
  }, [q, tag, page]);

  useEffect(() => { fetchPopularTags(); }, [fetchPopularTags]);
  useEffect(() => { setPage(1); fetchPosts({ page: 1 }); /* eslint-disable-next-line */ }, [tag]);

  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchPosts({ page: 1 });
  };

  const loadMore = async () => {
    const next = page + 1;
    setPage(next);
    await fetchPosts({ page: next, append: true });
  };

  const hasMore = items.length < total;

  return (
    <div className="min-h-screen paper-bg">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-20">
        <div className="mb-14 max-w-3xl">
          <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-4">Discover</div>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight mb-6">Quiet voices,<br /><span className="italic text-stone-500">loud truths.</span></h1>
          <p className="text-stone-600 dark:text-stone-400 leading-relaxed">Browse public journals from writers across the world.</p>
        </div>

        <form onSubmit={onSearch} className="flex gap-2 mb-6 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" strokeWidth={1.5} />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title, body, or feeling…"
              className="pl-10 rounded-md bg-transparent border-stone-200 dark:border-stone-800"
              data-testid="search-input"
            />
          </div>
          <Button type="submit" data-testid="search-btn" className="rounded-md">Search</Button>
        </form>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-12">
            <button
              onClick={() => setTag(null)}
              className={`px-3 py-1 rounded-sm text-[11px] font-mono uppercase tracking-wider transition-colors ${
                tag === null ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900" : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
              }`}
              data-testid="tag-all"
            >All</button>
            {tags.map((t) => (
              <button
                key={t.tag}
                onClick={() => setTag(t.tag)}
                className={`px-3 py-1 rounded-sm text-[11px] font-mono uppercase tracking-wider transition-colors ${
                  tag === t.tag ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900" : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
                }`}
                data-testid={`tag-${t.tag}`}
              >
                {t.tag} <span className="opacity-50">{t.count}</span>
              </button>
            ))}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="flex justify-center py-20" data-testid="discover-loading"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>
        ) : items.length === 0 ? (
          <div className="border border-dashed border-stone-300 dark:border-stone-700 rounded-md p-12 text-center" data-testid="discover-empty">
            <img src={emptyImg} alt="" className="h-32 w-32 object-cover rounded-md mx-auto mb-6 opacity-80" />
            <h3 className="font-serif text-2xl mb-2">Nothing here yet</h3>
            <p className="text-stone-500 text-sm">No public journals match your filters.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="post-grid">
              {items.map((p) => <PostCard key={p.post_id} post={p} />)}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-16">
                <Button variant="outline" onClick={loadMore} disabled={loading} className="rounded-md border-stone-300 dark:border-stone-700" data-testid="load-more">
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Load more
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
