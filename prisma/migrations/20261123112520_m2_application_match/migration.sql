-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_announcementId_companyId_fkey" FOREIGN KEY ("announcementId", "companyId") REFERENCES "Match"("announcementId", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
