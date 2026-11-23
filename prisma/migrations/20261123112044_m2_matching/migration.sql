-- CreateEnum
CREATE TYPE "ScoreStatus" AS ENUM ('pending', 'running', 'scored', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "Eligibility" AS ENUM ('eligible', 'uncertain', 'ineligible');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('new', 'triage', 'drafting', 'review', 'submitted', 'result_pass', 'result_fail', 'excluded');

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "hardFilterPassed" BOOLEAN NOT NULL,
    "excludeReason" TEXT,
    "filterNotes" TEXT[],
    "scoreStatus" "ScoreStatus" NOT NULL DEFAULT 'pending',
    "score" INTEGER,
    "reasons" JSONB,
    "risks" JSONB,
    "eligibility" "Eligibility",
    "suggestedItemCardId" TEXT,
    "scoredHash" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "scoredAt" TIMESTAMP(3),
    "scoreError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'new',
    "autoExcluded" BOOLEAN NOT NULL DEFAULT false,
    "excludedReason" TEXT,
    "ownerId" TEXT,
    "reviewerIds" TEXT[],
    "submittedAt" TIMESTAMP(3),
    "resultNote" TEXT,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "from" "ApplicationStatus",
    "to" "ApplicationStatus" NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Match_companyId_scoreStatus_idx" ON "Match"("companyId", "scoreStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Match_announcementId_companyId_key" ON "Match"("announcementId", "companyId");

-- CreateIndex
CREATE INDEX "Application_companyId_status_idx" ON "Application"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Application_announcementId_companyId_key" ON "Application"("announcementId", "companyId");

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_createdAt_idx" ON "ApplicationEvent"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
