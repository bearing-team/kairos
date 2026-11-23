-- CreateEnum
CREATE TYPE "ExclusionKind" AS ENUM ('keyword', 'region', 'target', 'industry');

-- CreateEnum
CREATE TYPE "AnnouncementSource" AS ENUM ('bizinfo', 'kstartup', 'manual', 'newsletter');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('notice', 'form', 'other');

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('pending', 'parsed', 'failed');

-- CreateTable
CREATE TABLE "ItemCard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "problem" TEXT,
    "solution" TEXT,
    "customer" TEXT,
    "differentiation" TEXT,
    "traction" TEXT,
    "links" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExclusionRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "ExclusionKind" NOT NULL,
    "value" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExclusionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "source" "AnnouncementSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "organization" TEXT,
    "executingOrg" TEXT,
    "summary" TEXT,
    "target" TEXT,
    "regionLimit" TEXT,
    "applyStart" TIMESTAMP(3),
    "applyEnd" TIMESTAMP(3),
    "applyPeriodText" TEXT,
    "supportAmountText" TEXT,
    "category" TEXT,
    "hashtags" TEXT[],
    "applyUrl" TEXT,
    "raw" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "duplicateOfId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileKey" TEXT,
    "mime" TEXT,
    "kind" "AttachmentKind" NOT NULL DEFAULT 'other',
    "parsed" JSONB,
    "parseStatus" "ParseStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "source" "AnnouncementSource" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemCard_companyId_idx" ON "ItemCard"("companyId");

-- CreateIndex
CREATE INDEX "ExclusionRule_companyId_idx" ON "ExclusionRule"("companyId");

-- CreateIndex
CREATE INDEX "Announcement_dedupeKey_idx" ON "Announcement"("dedupeKey");

-- CreateIndex
CREATE INDEX "Announcement_applyEnd_idx" ON "Announcement"("applyEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Announcement_source_externalId_key" ON "Announcement"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_announcementId_url_key" ON "Attachment"("announcementId", "url");

-- CreateIndex
CREATE INDEX "SyncRun_source_startedAt_idx" ON "SyncRun"("source", "startedAt");

-- AddForeignKey
ALTER TABLE "ItemCard" ADD CONSTRAINT "ItemCard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExclusionRule" ADD CONSTRAINT "ExclusionRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Announcement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
