import "server-only";
import { prisma } from "@/server/db";
import { API_SOURCES, sourceKey, type ApiSource } from "@/server/sources/sync";
import { isChecking } from "@/server/sources/boards";
import { countRows, type NewsletterRow } from "@/server/sources/newsletter";

export type ApiSourceRow = {
  kind: "api";
  key: ApiSource;
  connected: boolean;
  count: number;
  lastAt: Date | null;
  lastError: string | null;
  lastCreated: number | null;
};

export type BoardSourceRow = {
  kind: "board";
  id: string;
  name: string;
  url: string;
  host: string;
  enabled: boolean;
  checking: boolean;
  count: number;
  lastAt: Date | null;
  lastError: string | null;
  lastNote: string | null;
};

export type NewsletterIssueRow = { id: string; title: string; url: string; fetchedAt: Date; counts: ReturnType<typeof countRows> };

/** 공고 소스 화면: 기본 API 소스 + 등록한 게시판 (공고 수, 마지막 확인) */
export async function getSourceList(now = new Date()) {
  const [counts, runs, boards, issues] = await Promise.all([
    prisma.announcement.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.syncRun.findMany({ where: { source: { in: [...API_SOURCES] }, finishedAt: { not: null } }, orderBy: { startedAt: "desc" }, take: 20 }),
    prisma.boardSource.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { announcements: true } } } }),
    prisma.newsletterIssue.findMany({ orderBy: { fetchedAt: "desc" }, take: 20 }),
  ]);
  const api: ApiSourceRow[] = API_SOURCES.map((key) => {
    const last = runs.find((r) => r.source === key);
    return {
      kind: "api",
      key,
      connected: !!sourceKey(key),
      count: counts.find((c) => c.source === key)?._count._all ?? 0,
      lastAt: last?.finishedAt ?? null,
      lastError: last?.error ?? null,
      lastCreated: last && !last.error ? last.created : null,
    };
  });
  const board: BoardSourceRow[] = boards.map((b) => ({
    kind: "board",
    id: b.id,
    name: b.name,
    url: b.url,
    host: new URL(b.url).hostname.replace(/^www\./, ""),
    enabled: b.enabled,
    checking: isChecking(b, now),
    count: b._count.announcements,
    lastAt: b.lastCheckedAt,
    lastError: b.lastError,
    lastNote: b.lastNote,
  }));
  const newsletter: NewsletterIssueRow[] = issues.map((i) => ({
    id: i.id,
    title: i.title,
    url: i.url,
    fetchedAt: i.fetchedAt,
    counts: countRows(i.items as unknown as NewsletterRow[]),
  }));
  return { api, board, newsletter, newsletterCount: counts.find((c) => c.source === "newsletter")?._count._all ?? 0 };
}
