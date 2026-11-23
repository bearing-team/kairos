-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('preparing', 'generating', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "SectionStatus" AS ENUM ('empty', 'generating', 'done', 'failed');

-- CreateEnum
CREATE TYPE "RequiredDocStatus" AS ENUM ('ready', 'missing', 'na');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "downloadedAt" TIMESTAMP(3),
ADD COLUMN     "parseError" TEXT,
ADD COLUMN     "sha256" TEXT,
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "text" TEXT;

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'preparing',
    "templateSource" TEXT,
    "formAttachmentId" TEXT,
    "criteria" TEXT[],
    "notes" TEXT[],
    "error" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftSection" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "guidance" TEXT,
    "limitChars" INTEGER,
    "content" TEXT NOT NULL DEFAULT '',
    "needsCheck" TEXT[],
    "generatedBy" TEXT,
    "status" "SectionStatus" NOT NULL DEFAULT 'empty',
    "error" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequiredDoc" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "RequiredDocStatus" NOT NULL DEFAULT 'missing',
    "source" TEXT NOT NULL DEFAULT 'announcement',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequiredDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Draft_applicationId_version_key" ON "Draft"("applicationId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DraftSection_draftId_order_key" ON "DraftSection"("draftId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "RequiredDoc_applicationId_name_key" ON "RequiredDoc"("applicationId", "name");

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_formAttachmentId_fkey" FOREIGN KEY ("formAttachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftSection" ADD CONSTRAINT "DraftSection_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequiredDoc" ADD CONSTRAINT "RequiredDoc_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
