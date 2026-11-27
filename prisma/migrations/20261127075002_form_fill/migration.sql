-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "address" TEXT,
ADD COLUMN     "ceoName" TEXT,
ADD COLUMN     "contactDept" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "contactTel" TEXT,
ADD COLUMN     "contactTitle" TEXT;

-- AlterTable
ALTER TABLE "DraftSection" ADD COLUMN     "field" JSONB;
