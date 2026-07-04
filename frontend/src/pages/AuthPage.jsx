import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const heroImg = "https://images.unsplash.com/photo-1579017308347-e53e0d2fc5e9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwyfHx3cml0aW5nJTIwam91cm5hbCUyMGFlc3RoZXRpY3xlbnwwfHx8fDE3ODI3NTc2Nzh8MA&ixlib=rb-4.1.0&q=85";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("signin");
  const [loading, setLoading] = useState(false);
  const [signin, setSignin] = useState({ email: "", password: "" });
  const [signup, setSignup] = useState({ name: "", email: "", password: "" });

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/auth/google/url");
      window.location.href = data.url;
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Google sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(signin.email, signin.password);
      toast.success("Welcome back");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Sign in failed");
    } finally { setLoading(false); }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(signup.email, signup.password, signup.name);
      toast.success("Welcome to Tani");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Sign up failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:block relative">
        <img src={heroImg} alt="Writing" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-stone-900/30" />
        <div className="absolute bottom-12 left-12 right-12 text-stone-50">
          <div className="text-xs uppercase tracking-[0.3em] mb-4 opacity-80">The Tani Journal</div>
          <h2 className="font-serif text-4xl leading-tight max-w-md">&ldquo;To write is to listen to oneself a little more carefully.&rdquo;</h2>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-3">Begin again</div>
          <h1 className="font-serif text-4xl sm:text-5xl mb-2">Welcome</h1>
          <p className="text-stone-500 mb-10">Sign in or create your private journal.</p>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin" data-testid="tab-signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignin} className="space-y-5">
                <div>
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" required value={signin.email}
                    onChange={(e) => setSignin({ ...signin, email: e.target.value })}
                    className="mt-1.5 rounded-md" data-testid="signin-email" />
                </div>
                <div>
                  <Label htmlFor="si-password">Password</Label>
                  <Input id="si-password" type="password" required value={signin.password}
                    onChange={(e) => setSignin({ ...signin, password: e.target.value })}
                    className="mt-1.5 rounded-md" data-testid="signin-password" />
                </div>
                <Button type="submit" disabled={loading} className="w-full rounded-md" data-testid="signin-submit">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-5">
                <div>
                  <Label htmlFor="su-name">Name</Label>
                  <Input id="su-name" required value={signup.name}
                    onChange={(e) => setSignup({ ...signup, name: e.target.value })}
                    className="mt-1.5 rounded-md" data-testid="signup-name" />
                </div>
                <div>
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" required value={signup.email}
                    onChange={(e) => setSignup({ ...signup, email: e.target.value })}
                    className="mt-1.5 rounded-md" data-testid="signup-email" />
                </div>
                <div>
                  <Label htmlFor="su-password">Password (min 6 chars)</Label>
                  <Input id="su-password" type="password" minLength={6} required value={signup.password}
                    onChange={(e) => setSignup({ ...signup, password: e.target.value })}
                    className="mt-1.5 rounded-md" data-testid="signup-password" />
                </div>
                <Button type="submit" disabled={loading} className="w-full rounded-md" data-testid="signup-submit">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-stone-200 dark:border-stone-800" /></div>
            <div className="relative flex justify-center text-xs uppercase tracking-[0.2em]">
              <span className="bg-background px-4 text-stone-500">or</span>
            </div>
          </div>

          <Button variant="outline" onClick={handleGoogle} className="w-full rounded-md border-stone-300 dark:border-stone-700" data-testid="google-signin">
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
