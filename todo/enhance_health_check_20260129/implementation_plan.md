# Implementation Plan - Enhancing API Health Check

The user correctly points out that a simple API health check is insufficient if it doesn't verify the database connection. I will update the backend health check endpoint to include a database connectivity test.

## Proposed Changes

### Backend Route (`server/routes/v1/index.js`)

#### [Updated] `/health` Endpoint
- Import the database `query` function.
- Update the GET handler to be `async`.
- Execute a simple SQL query (`SELECT 1`) to verify DB connectivity.
- Return `503 Service Unavailable` if the DB query fails, ensuring the frontend treats it as "Disconnected" or "Error".

## Verification

### Automated Verification
- None tailored.

### Manual Verification
1.  Save changes.
2.  Restart the backend server (`npm run dev` in `server/`).
3.  Refresh the frontend.
4.  The "Checking API Health" process will now inherently test the DB connection.
5.  (Optional) Temporarily stop the Postgres service to verify the check fails as expected.
