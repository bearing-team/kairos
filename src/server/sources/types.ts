import type { AnnouncementSource, AttachmentKind } from "@/generated/prisma/client";

/** 소스별 파서가 돌려주는 정규화된 공고. DB 저장 직전 형태 */
export type NormalizedAnnouncement = {
  source: AnnouncementSource;
  externalId: string;
  url: string | null;
  title: string;
  organization: string | null;
  executingOrg: string | null;
  summary: string | null;
  target: string | null;
  regionLimit: string | null;
  applyStart: Date | null;
  applyEnd: Date | null;
  applyPeriodText: string | null;
  supportAmountText: string | null;
  category: string | null;
  hashtags: string[];
  applyUrl: string | null;
  boardSourceId?: string | null; // source=board일 때
  attachments: { fileName: string; url: string; kind: AttachmentKind }[];
  raw: Record<string, unknown>;
};

export class SourceError extends Error {
  constructor(
    public source: AnnouncementSource,
    message: string,
  ) {
    super(message);
  }
}
