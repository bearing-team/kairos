// pnpm sync:probe — 실제 API 응답을 fixtures/<source>/live-YYYYMMDD.json으로 저장 (DB에는 안 씀)
// 파서 필드 확인·회귀 테스트용. 항목은 앞 20건만 남긴다.
import "dotenv/config";
import { ensureSecrets } from "@/server/secrets";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { API_SOURCES, fetchSource, sourceKey } from "@/server/sources/sync";
import { BIZINFO_URL } from "@/server/sources/bizinfo";
import { KSTARTUP_URL } from "@/server/sources/kstartup";

function trim(body: unknown): unknown {
  if (Array.isArray(body)) return body.slice(0, 20);
  if (body && typeof body === "object") {
    return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, Array.isArray(v) || (v && typeof v === "object") ? trim(v) : v]));
  }
  return body;
}

async function main() {
  await ensureSecrets(true); // 화면에서 넣은 연결 키
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
  for (const source of API_SOURCES) {
    const key = sourceKey(source);
    if (!key) {
      console.log(`- ${source}: 키 없음, 건너뜀`);
      continue;
    }
    try {
      // 원본을 먼저 받아 저장한다. 파싱 실패해도 응답은 남아야 필드를 확인할 수 있다
      const url = new URL(source === "bizinfo" ? BIZINFO_URL : KSTARTUP_URL);
      if (source === "bizinfo") {
        url.searchParams.set("crtfcKey", key);
        url.searchParams.set("dataType", "json");
        url.searchParams.set("searchCnt", "20");
      } else {
        url.searchParams.set("serviceKey", decodeURIComponent(key));
        url.searchParams.set("page", "1");
        url.searchParams.set("perPage", "20");
        url.searchParams.set("returnType", "json");
      }
      const res = await fetch(url);
      const text = await res.text();
      const dir = path.join("fixtures", source);
      mkdirSync(dir, { recursive: true });
      let file: string;
      try {
        file = path.join(dir, `live-${day}.json`);
        writeFileSync(file, JSON.stringify(trim(JSON.parse(text)), null, 2) + "\n");
      } catch {
        file = path.join(dir, `live-${day}.raw.txt`);
        writeFileSync(file, text);
      }
      console.log(`✓ ${source}: HTTP ${res.status} → ${file}`);
      const { items } = await fetchSource(source, key).catch((e) => ({ items: [], err: e }));
      console.log(`  파서 결과: ${items.length}건`);
    } catch (e) {
      console.log(`✗ ${source}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main();
