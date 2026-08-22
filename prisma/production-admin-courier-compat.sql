-- AutoFood production compatibility migration for legacy admin/courier fields.
-- Additive/data-preserving only: intentionally does not drop or rewrite existing data.

BEGIN;

ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "transportType" TEXT;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "vehicleNumber" TEXT;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "maxLoad" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "isOnShift" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "shiftStartedAt" TIMESTAMP(3);
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "shiftEndedAt" TIMESTAMP(3);
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "averageDeliveryMinutes" DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS "admins_createdBy_role_idx" ON "admins" ("createdBy", "role");

COMMIT;
