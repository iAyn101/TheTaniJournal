import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { PenLine, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const emptyImg = "https://images.unsplash.com/photo-1586380951230-e6703d9f6833?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwxfHx3cml0aW5nJTIwam91cm5hbCUyMGFlc3RoZXRpY3xlbnwwfHx8fDE3ODI3NTc2Nzh8MA&ixlib=rb-4.1.0&q=85";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/posts/mine");
        setPosts(data);
      } finally { setLoading(false); }
    })();
  }, []);

  const publicCount = posts.filter(p => p.is_public).length;
  const privateCount = posts.length - publicCount;

  return (
    <div className="min-h-screen paper-bg">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-3">Your journal</div>
            <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">Hello, {user?.name?.split(" ")[0]}</h1>
            <p className="text-stone-500 mt-2">{posts.length} entries · {publicCount} public · {privateCount} private</p>
          </div>
          <Button onClick={() => navigate("/editor")} className="rounded-md" data-testid="dashboard-new">
            <PenLine className="h-4 w-4 mr-2" strokeWidth={1.5} /> Write a new entry
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>
        ) : posts.length === 0 ? (
          <div className="border border-dashed border-stone-300 dark:border-stone-700 rounded-md p-12 text-center" data-testid="dashboard-empty">
            <img src={emptyImg} alt="" className="h-32 w-32 object-cover rounded-md mx-auto mb-6 opacity-80" />
            <h3 className="font-serif text-2xl mb-2">A blank page awaits.</h3>
            <p className="text-stone-500 text-sm mb-6">Start your first entry — it can be small.</p>
            <Link to="/editor"><Button className="rounded-md">Begin writing</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="dashboard-grid">
            {posts.map((p) => <PostCard key={p.post_id} post={p} showPrivate />)}
          </div>
        )}
      </main>
    </div>
  );
}
