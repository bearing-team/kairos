-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "newsletterIssueId" TEXT;

-- CreateTable
CREATE TABLE "NewsletterIssue" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pdfSrc" TEXT,
    "items" JSONB NOT NULL,
    "createdById" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterIssue_key_key" ON "NewsletterIssue"("key");

-- CreateIndex
CREATE INDEX "Announcement_newsletterIssueId_idx" ON "Announcement"("newsletterIssueId");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_newsletterIssueId_fkey" FOREIGN KEY ("newsletterIssueId") REFERENCES "NewsletterIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
