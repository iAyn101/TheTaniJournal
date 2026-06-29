# Auth Testing Playbook (Tani Journal)

## Test User Setup (via MongoDB)
```
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  auth_provider: 'google',
  bio: '',
  last_seen: new Date(),
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Email/Password Credentials
See `/app/memory/test_credentials.md` for seeded demo accounts.

## Endpoints to test
- POST /api/auth/register {email, password, name}
- POST /api/auth/login {email, password}
- POST /api/auth/google/session (with X-Session-ID header)
- GET /api/auth/me (Authorization: Bearer <token> OR cookie)
- POST /api/auth/logout
- POST /api/auth/heartbeat (auth)
- CRUD on /api/posts
- Comments /api/posts/{id}/comments
- Reports /api/reports
