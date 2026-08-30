-- One-time Google Calendar / Contacts import (read-only). Storing a
-- refresh token is enough to pull a fresh import on demand; no sync-token
-- or webhook bookkeeping since this isn't an ongoing two-way sync.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "googleRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN "googleConnectedAt" TIMESTAMP(3);
