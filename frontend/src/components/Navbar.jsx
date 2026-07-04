import { Link, NavLink, useNavigate } from "react-router-dom";
import { Moon, Sun, Menu, PenLine, LogOut, LayoutDashboard, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import PresenceAvatar from "@/components/PresenceAvatar";
import { useState } from "react";

const navItems = [
  { to: "/discover", label: "Discover", icon: Compass },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-stone-50/80 dark:bg-stone-950/80 border-b border-stone-200/60 dark:border-stone-800/60">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" data-testid="logo-link" className="flex items-center gap-2">
          <span className="font-serif text-2xl tracking-tight">The Tani Journal</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={({ isActive }) =>
                `px-3 py-2 text-sm transition-colors ${
                  isActive ? "text-foreground" : "text-stone-500 hover:text-foreground"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {user && (
            <>
              <NavLink
                to="/dashboard"
                data-testid="nav-dashboard"
                className={({ isActive }) =>
                  `px-3 py-2 text-sm transition-colors ${
                    isActive ? "text-foreground" : "text-stone-500 hover:text-foreground"
                  }`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/settings"
                data-testid="nav-settings"
                className={({ isActive }) =>
                  `px-3 py-2 text-sm transition-colors ${
                    isActive ? "text-foreground" : "text-stone-500 hover:text-foreground"
                  }`
                }
              >
                Settings
              </NavLink>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            data-testid="theme-toggle"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" strokeWidth={1.5} /> : <Moon className="h-4 w-4" strokeWidth={1.5} />}
          </Button>

          {user ? (
            <>
              <Button
                onClick={() => navigate("/editor")}
                data-testid="new-post-btn"
                className="hidden sm:inline-flex rounded-md"
              >
                <PenLine className="h-4 w-4 mr-2" strokeWidth={1.5} /> Write
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button data-testid="user-menu-trigger" className="outline-none focus:ring-2 focus:ring-stone-400 rounded-full">
                    <PresenceAvatar user={user} size="md" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2">
                    <div className="text-sm font-medium">{user.name}</div>
                    <div className="text-xs text-stone-500">{user.email}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-dashboard" onClick={() => navigate("/dashboard")}>
                    <LayoutDashboard className="h-4 w-4 mr-2" strokeWidth={1.5} /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="menu-profile" onClick={() => navigate(`/profile/${user.user_id}`)}>
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="menu-new" onClick={() => navigate("/editor")}>
                    <PenLine className="h-4 w-4 mr-2" strokeWidth={1.5} /> New entry
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-logout" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" strokeWidth={1.5} /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button onClick={() => navigate("/auth")} data-testid="signin-btn" className="rounded-md">
              Sign in
            </Button>
          )}

          {/* Mobile */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" data-testid="mobile-menu-trigger">
                <Menu className="h-5 w-5" strokeWidth={1.5} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-80 bg-background">
              <div className="mt-12 flex flex-col gap-2">
                <Link to="/discover" onClick={() => setOpen(false)} className="text-2xl font-serif py-3 border-b border-stone-200 dark:border-stone-800" data-testid="mobile-discover">Discover</Link>
                {user && (
                  <>
                    <Link to="/dashboard" onClick={() => setOpen(false)} className="text-2xl font-serif py-3 border-b border-stone-200 dark:border-stone-800" data-testid="mobile-dashboard">Dashboard</Link>
                    <Link to="/settings" onClick={() => setOpen(false)} className="text-2xl font-serif py-3 border-b border-stone-200 dark:border-stone-800" data-testid="mobile-settings">Settings</Link>
                    <Link to="/editor" onClick={() => setOpen(false)} className="text-2xl font-serif py-3 border-b border-stone-200 dark:border-stone-800" data-testid="mobile-new">New entry</Link>
                    <Link to={`/profile/${user.user_id}`} onClick={() => setOpen(false)} className="text-2xl font-serif py-3 border-b border-stone-200 dark:border-stone-800" data-testid="mobile-profile">Profile</Link>
                    <button onClick={async () => { setOpen(false); await handleLogout(); }} className="text-2xl font-serif py-3 text-left text-stone-500" data-testid="mobile-logout">Sign out</button>
                  </>
                )}
                {!user && (
                  <Link to="/auth" onClick={() => setOpen(false)} className="text-2xl font-serif py-3" data-testid="mobile-signin">Sign in</Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
