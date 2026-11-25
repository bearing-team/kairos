-- AlterEnum
ALTER TYPE "AnnouncementSource" ADD VALUE 'board';

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "boardSourceId" TEXT;

-- AlterTable
ALTER TABLE "SyncRun" ADD COLUMN     "boardSourceId" TEXT;

-- CreateTable
CREATE TABLE "BoardSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "knownLinks" TEXT[],
    "checkingAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardSource_url_key" ON "BoardSource"("url");

-- CreateIndex
CREATE INDEX "Announcement_boardSourceId_idx" ON "Announcement"("boardSourceId");

-- CreateIndex
CREATE INDEX "SyncRun_boardSourceId_startedAt_idx" ON "SyncRun"("boardSourceId", "startedAt");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_boardSourceId_fkey" FOREIGN KEY ("boardSourceId") REFERENCES "BoardSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_boardSourceId_fkey" FOREIGN KEY ("boardSourceId") REFERENCES "BoardSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
