# Avatar Persistence Fix Implementation Plan

The user avatar reverts to default on page refresh because the `GET /api/v1/auth/me` endpoint returns user data decoded from the JWT token, which is stateless and contains stale data (missing the updated `avatarUrl`).

To fix this, we will modify the `GET /api/v1/auth/me` endpoint to fetch the latest user details from the database.

## User Review Required

> [!NOTE]
> This change primarily affects the backend `GET /me` endpoint. It ensures that whenever the frontend initializes the user session, it gets the most up-to-date user profile (name, avatar, etc.) from the database instead of relying on the information embedded in the JWT token at login time.

## Proposed Changes

### Backend

#### [MODIFY] [server/routes/v1/auth.js](file:///d:/TwinSIght/antigravity/twinsight/server/routes/v1/auth.js)

- Update the `GET /me` route handler.
- Instead of returning `req.user`, call `userModel.findById(req.user.sub)`.
- Construct the response object using the fresh DB data.
- Ensure `avatar_url` from the database is mapped to `avatarUrl` in the JSON response to match the frontend expectation.
- Note: We will continue to use `req.user.roles` and `req.user.permissions` for now to minimize impact, or we can fetch roles if `userModel` supports it easily (it does via `getUserRoles`). To be safe and consistent with current excessive token reliance, we can stick to token roles or fetch them.
    - *Decision*: Since `userModel.findById` doesn't return roles, and we want to be minimally invasive, we will use `req.user.roles` from the token for authorization context, but use DB for profile data (name, email, avatar). If the token is refreshed, roles update. But avatar updates don't trigger token refresh usually.
    - However, `server/models/user.js` has `getUserRoles`. We *could* fetch them to be 100% fresh. But let's focus on the reported bug (Avatar).

## Verification Plan

### Automated Tests
- None existing for this specific endpoint behavior in terms of "freshness".

### Manual Verification
1.  **Login** to the application.
2.  **Upload a new avatar** in the user profile settings.
3.  **Verify** the avatar updates immediately (this currently works).
4.  **Refresh the page** (F5).
5.  **Verify** the new avatar persists and is displayed in the top right corner.
6.  **Verify** other user info (name, email) is also correct.
