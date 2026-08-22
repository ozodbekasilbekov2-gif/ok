-- AutoFood production compatibility migration for the legacy Neon schema.
-- Additive/data-preserving only: intentionally does not drop legacy columns or data.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status_new') THEN
    CREATE TYPE "order_status_new" AS ENUM ('NEW', 'PENDING', 'IN_PROCESS', 'IN_DELIVERY', 'PAUSED', 'DELIVERED', 'CANCELED', 'FAILED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderType') THEN
    CREATE TYPE "OrderType" AS ENUM ('MORNING', 'EVENING');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderEventType') THEN
    CREATE TYPE "OrderEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'DETAILS_UPDATED', 'COURIER_ASSIGNED', 'COURIER_UNASSIGNED', 'DELIVERY_STARTED', 'DELIVERY_PAUSED', 'DELIVERY_RESUMED', 'DELIVERY_COMPLETED', 'PAYMENT_UPDATED', 'REORDERED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeatureType') THEN
    CREATE TYPE "FeatureType" AS ENUM ('TEXT', 'SELECT');
  END IF;
END $$;

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'TRANSFER';

CREATE TABLE IF NOT EXISTS "menu_sets" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "menuNumber" INTEGER NOT NULL DEFAULT 0,
  "calorieGroups" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "adminId" TEXT,
  CONSTRAINT "menu_sets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_audit_events" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "eventType" "OrderEventType" NOT NULL,
  "actorAdminId" TEXT,
  "actorRole" TEXT,
  "actorName" TEXT,
  "previousStatus" "order_status_new",
  "nextStatus" "order_status_new",
  "payload" JSONB,
  "message" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "features" (
  "id" TEXT NOT NULL,
  "ownerAdminId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "type" "FeatureType" NOT NULL,
  "options" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "assignedSetId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "status" "order_status_new" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pickedUpAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "resumedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "etaMinutes" INTEGER;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "routeDistanceKm" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "routeDurationMin" INTEGER;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "sequenceInRoute" INTEGER;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customerRating" INTEGER;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customerFeedback" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "lastLatitude" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "lastLongitude" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "lastLocationAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "sourceChannel" TEXT DEFAULT 'ADMIN_PANEL';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "orderType" "OrderType" NOT NULL DEFAULT 'MORNING';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fromAutoOrder" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "orders"
SET "status" = CASE "orderStatus"::text
  WHEN 'IN_DELIVERY' THEN 'IN_DELIVERY'::"order_status_new"
  WHEN 'PAUSED' THEN 'PAUSED'::"order_status_new"
  WHEN 'DELIVERED' THEN 'DELIVERED'::"order_status_new"
  WHEN 'FAILED' THEN 'FAILED'::"order_status_new"
  ELSE 'PENDING'::"order_status_new"
END,
"fromAutoOrder" = COALESCE("isAutoOrder", FALSE)
WHERE "status" IS NULL OR "status" = 'PENDING'::"order_status_new";

ALTER TABLE "orders" ALTER COLUMN "deliveryTime" DROP NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "adminId" DROP NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "deliveryDate" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "orders" ALTER COLUMN "calories" SET DEFAULT 1600;
ALTER TABLE "orders" ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID';
ALTER TABLE "orders" ALTER COLUMN "paymentMethod" SET DEFAULT 'CASH';

ALTER TABLE "action_logs" ADD COLUMN IF NOT EXISTS "details" TEXT;
ALTER TABLE "action_logs" ALTER COLUMN "entityType" DROP NOT NULL;
ALTER TABLE "action_logs" ALTER COLUMN "entityId" DROP NOT NULL;
ALTER TABLE "interface_configs" ADD COLUMN IF NOT EXISTS "theme" TEXT NOT NULL DEFAULT 'light';
ALTER TABLE "interface_configs" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'ru';
ALTER TABLE "interface_configs" ALTER COLUMN "buttonConfig" DROP NOT NULL;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "lastMessage" TEXT;
ALTER TABLE "warehouse_items" ADD COLUMN IF NOT EXISTS "kcalPerGram" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "warehouse_items" ADD COLUMN IF NOT EXISTS "pricePerUnit" DOUBLE PRECISION;
ALTER TABLE "warehouse_items" ADD COLUMN IF NOT EXISTS "priceUnit" TEXT NOT NULL DEFAULT 'kg';
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "salaryRecipientAdminId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "customers_phone_createdBy_deletedAt_key" ON "customers" ("phone", "createdBy", "deletedAt");
CREATE INDEX IF NOT EXISTS "customers_createdBy_deletedAt_idx" ON "customers" ("createdBy", "deletedAt");
CREATE INDEX IF NOT EXISTS "orders_adminId_deletedAt_createdAt_idx" ON "orders" ("adminId", "deletedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_customerId_deletedAt_createdAt_idx" ON "orders" ("customerId", "deletedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_courierId_deliveryDate_deletedAt_idx" ON "orders" ("courierId", "deliveryDate", "deletedAt");
CREATE INDEX IF NOT EXISTS "orders_status_deliveryDate_idx" ON "orders" ("status", "deliveryDate");
CREATE INDEX IF NOT EXISTS "action_logs_adminId_idx" ON "action_logs" ("adminId");
CREATE INDEX IF NOT EXISTS "transactions_salaryRecipientAdminId_idx" ON "transactions" ("salaryRecipientAdminId");
CREATE INDEX IF NOT EXISTS "menu_sets_adminId_idx" ON "menu_sets" ("adminId");
CREATE INDEX IF NOT EXISTS "features_ownerAdminId_idx" ON "features" ("ownerAdminId");
CREATE INDEX IF NOT EXISTS "order_audit_events_orderId_occurredAt_idx" ON "order_audit_events" ("orderId", "occurredAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_assignedSetId_fkey') THEN
    ALTER TABLE "customers" ADD CONSTRAINT "customers_assignedSetId_fkey"
      FOREIGN KEY ("assignedSetId") REFERENCES "menu_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'menu_sets_adminId_fkey') THEN
    ALTER TABLE "menu_sets" ADD CONSTRAINT "menu_sets_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_audit_events_orderId_fkey') THEN
    ALTER TABLE "order_audit_events" ADD CONSTRAINT "order_audit_events_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_audit_events_actorAdminId_fkey') THEN
    ALTER TABLE "order_audit_events" ADD CONSTRAINT "order_audit_events_actorAdminId_fkey"
      FOREIGN KEY ("actorAdminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'features_ownerAdminId_fkey') THEN
    ALTER TABLE "features" ADD CONSTRAINT "features_ownerAdminId_fkey"
      FOREIGN KEY ("ownerAdminId") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_salaryRecipientAdminId_fkey') THEN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_salaryRecipientAdminId_fkey"
      FOREIGN KEY ("salaryRecipientAdminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
