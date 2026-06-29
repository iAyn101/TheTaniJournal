import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser, refresh } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) {
      navigate("/auth", { replace: true });
      return;
    }
    const sessionId = m[1];

    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", null, {
          headers: { "X-Session-ID": sessionId },
        });
        if (data.session_token) {
          localStorage.setItem("tani_token", data.session_token);
        }
        if (setUser) setUser(data.user);
        else await refresh();
        toast.success(`Welcome, ${data.user.name}`);
        // clear hash and navigate
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/dashboard", { replace: true, state: { user: data.user } });
      } catch (e) {
        toast.error("Sign in failed");
        navigate("/auth", { replace: true });
      }
    })();
  }, [navigate, setUser, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center" data-testid="auth-callback">
      <div className="text-stone-500 text-sm tracking-widest uppercase">Signing you in…</div>
    </div>
  );
}
