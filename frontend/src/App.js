import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/AuthPage";
import AuthCallback from "@/pages/AuthCallback";
import DiscoverPage from "@/pages/DiscoverPage";
import PostReader from "@/pages/PostReader";
import EditorPage from "@/pages/EditorPage";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import AdminPage from "@/pages/AdminPage";
import ProtectedRoute from "@/components/ProtectedRoute";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function AppRouter() {
  const location = useLocation();
  // Detect OAuth callback query or legacy session hash synchronously
  if (location.hash?.includes("session_id=") || location.search?.includes("code=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/discover" element={<DiscoverPage />} />
      <Route path="/post/:postId" element={<PostReader />} />
      <Route path="/profile/:userId" element={<Profile />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/editor/:postId" element={<EditorPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
