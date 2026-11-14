CREATE TABLE "LebihanTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noOrder" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kv" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "lebihan" INTEGER NOT NULL,
    "naskahGuru" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "LebihanTag_status_createdAt_idx" ON "LebihanTag"("status", "createdAt");
CREATE INDEX "LebihanTag_noOrder_idx" ON "LebihanTag"("noOrder");
