// 회사 1개를 만든다. 확인된 사실만 넣고 나머지는 회사 프로필 화면(M1)에서 채운다.
import "dotenv/config";
import { prisma } from "../src/server/db";

async function main() {
  const existing = await prisma.company.findFirst();
  if (existing) {
    console.log(`회사가 이미 있어요: ${existing.name}`);
    return;
  }
  const company = await prisma.company.create({
    data: {
      name: "베어링(주)",
      industryLabel: "SW 스타트업",
      region: "부산",
      bizType: "corporation",
      headcount: 4,
      // foundedAt: 설립일 확인 후 입력 (업력 계산에 쓰임)
    },
  });
  console.log(`회사 생성: ${company.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
