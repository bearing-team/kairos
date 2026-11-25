-- CreateTable
CREATE TABLE "AppSecret" (
    "name" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSecret_pkey" PRIMARY KEY ("name")
);
