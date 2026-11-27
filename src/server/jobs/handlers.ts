// 응답 뒤에 도는 작업들. 로컬은 웹 프로세스의 after()로, 배포(Amplify)는 pg-boss 큐 → 워커(Fargate)가 같은 함수를 부른다
// 워커·tsx에서도 쓰므로 server-only·next/* 를 가져오지 않는다
import { llmConfigured } from "@/server/llm";
import { refreshMatches, scorePending } from "@/server/matching/run";
import { checkBoard } from "@/server/sources/boards";
import { generateSections, runDraft } from "@/server/drafting/run";
import { sendReviewRequest, sendWorkRequest } from "@/server/notify/run";

export type BackgroundJob =
  | { kind: "draft-run"; draftId: string }
  | { kind: "draft-sections"; draftId: string; sectionIds?: string[]; instruction?: string }
  | { kind: "score-pending" }
  | { kind: "board-check"; boardId: string }
  | { kind: "review-request"; applicationId: string; userId: string }
  | { kind: "work-request"; requestId: string };

export async function runJob(job: BackgroundJob): Promise<void> {
  switch (job.kind) {
    case "draft-run":
      return runDraft(job.draftId);
    case "draft-sections":
      await generateSections(job.draftId, { sectionIds: job.sectionIds, instruction: job.instruction });
      return;
    case "score-pending":
      await scorePending();
      return;
    case "board-check": {
      // 게시판 확인 → 새 공고 규칙 검사 → 점수 (claimBoard는 요청한 쪽에서 이미 했다)
      const r = await checkBoard(job.boardId, { claimed: true });
      if (r.createdIds.length) {
        await refreshMatches({ announcementIds: r.createdIds });
        if (llmConfigured()) await scorePending();
      }
      return;
    }
    case "review-request":
      await sendReviewRequest(job.applicationId, job.userId);
      return;
    case "work-request":
      await sendWorkRequest(job.requestId);
      return;
  }
}

export const describeJob = (job: BackgroundJob) => ("draftId" in job ? `${job.kind} ${job.draftId}` : "boardId" in job ? `${job.kind} ${job.boardId}` : job.kind);
