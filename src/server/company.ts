import "server-only";
import { prisma } from "@/server/db";

/** 지금은 회사 1개. 없으면 만든다 */
export async function getCompany() {
  const found = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  return found ?? prisma.company.create({ data: { name: "베어링(주)" } });
}
