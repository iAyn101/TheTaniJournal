import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function PresenceAvatar({ user, size = "md", className, showDot = true }) {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
    xl: "h-24 w-24",
  };
  const dotSizes = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
    xl: "h-4 w-4",
  };
  const initials = (user?.name || "?").split(" ").map(s => s[0]).slice(0, 2).join("");
  return (
    <div className={cn("relative inline-block", className)} data-testid="presence-avatar">
      <Avatar className={cn(sizes[size], "ring-1 ring-stone-200 dark:ring-stone-800")}>
        <AvatarImage src={user?.picture} alt={user?.name} />
        <AvatarFallback className="font-serif">{initials}</AvatarFallback>
      </Avatar>
      {showDot && (
        <span
          data-testid={user?.is_online ? "presence-dot-online" : "presence-dot-offline"}
          title={user?.is_online ? "Online" : "Offline"}
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-background",
            dotSizes[size],
            user?.is_online ? "bg-blue-500" : "bg-stone-800 dark:bg-stone-700"
          )}
        />
      )}
    </div>
  );
}
