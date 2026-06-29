# The Tani Journal — PRD

## Original Problem Statement
Build "The Tani Journal" — a responsive journal website with:
- Auth (Google OAuth + email/password)
- Real-time online presence (blue/dark dots)
- Full CRUD on journal entries
- Private/public toggle
- Comments + report flow
- Rich text WYSIWYG editor
- Searchable feed, tags, pagination
- User profiles with bio/avatar
- Responsive nav + hamburger mobile
- Light/dark mode
Storage requirement: Google Drive (deferred to v2 per user clarification).

## Architecture
- **Backend**: FastAPI + MongoDB (motor), `/api` prefix.
- **Frontend**: React 19 + Tailwind + Shadcn UI + React Router 7 + React Quill.
- **Auth**: Email/password (bcrypt + session_token) AND Emergent-managed Google OAuth, both writing to the same `user_sessions` collection. Cookie + Bearer header both supported.
- **Presence**: Polling heartbeat every 30s -> updates `last_seen`. User is "online" if `last_seen` < 60s.

## Personas
- **Reflective writer**: keeps private daily entries.
- **Essayist**: publishes longer-form public posts and follows others.
- **Casual reader**: browses public journals without an account.

## Core requirements (static)
- All routes under `/api`
- Stone/warm palette, Cormorant Garamond + Outfit fonts
- Dark mode parity
- data-testid on all interactive elements

## Implemented (2026-06-29)
- Backend: register/login/me/logout/heartbeat; Google session exchange; users get/update; posts CRUD with filters + pagination; popular tags; comments CRUD; reports.
- Frontend pages: Landing, Auth (tabs + Google), AuthCallback, Discover (search/tag/load more), PostReader (with comments + report + edit/delete), Editor (Quill + cover + tags + privacy toggle), Dashboard, Profile (with edit dialog).
- Components: Navbar (desktop + mobile sheet), PresenceAvatar, PostCard, RichTextEditor, CommentSection, ProtectedRoute.
- Light/Dark mode via ThemeContext.
- Heartbeat presence polling.
- Tested: 39/39 backend tests pass; all frontend flows pass.

## Prioritized backlog
**P1**
- Google Drive backup/export integration (deferred storage requirement)
- Cover image upload (currently URL only) via object storage
- Server-Sent Events or WebSockets for true real-time presence

**P2**
- Email verification + password reset flow
- Follow/unfollow other writers
- "Saved/Bookmarked" posts
- Markdown export of entries
- Admin moderation queue for reports

**P3**
- AI writing prompts ("On this day…")
- Public RSS feed per author
- Reading time estimate
