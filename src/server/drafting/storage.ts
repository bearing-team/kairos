// 파일 저장소 (공고 첨부·양식).
// - STORAGE_DRIVER=local(기본): 로컬 디스크 STORAGE_DIR(기본 ./storage)
// - STORAGE_DRIVER=s3: S3_BUCKET. 배포(Amplify 웹 + Fargate 워커)는 디스크가 남지 않아서 이쪽.
//   자격 증명은 기본 체인(Amplify 컴퓨트 역할·ECS 작업 역할). S3 호환 저장소면 S3_ENDPOINT + S3_ACCESS_KEY/S3_SECRET_KEY
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// turbopackIgnore: 이 경로 때문에 standalone 빌드가 프로젝트 전체(.env 포함)를 묶지 않게
const root = () => resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR?.trim() || "storage");
const s3Enabled = () => process.env.STORAGE_DRIVER?.trim() === "s3";
const objectKey = (key: string) => `attachments/${key}`;

let s3: S3Client | null = null;
function s3Client(): { client: S3Client; bucket: string } {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) throw new Error("STORAGE_DRIVER=s3인데 S3_BUCKET이 없어요");
  if (!s3) {
    const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
    const accessKeyId = process.env.S3_ACCESS_KEY?.trim();
    const secretAccessKey = process.env.S3_SECRET_KEY?.trim();
    s3 = new S3Client({
      // Amplify는 AWS_ 로 시작하는 환경 변수를 못 넣게 해서 S3_REGION을 따로 둔다
      region: process.env.S3_REGION?.trim() || process.env.AWS_REGION || "ap-northeast-2",
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }
  return { client: s3, bucket };
}

/** 내용 해시로 이름을 정한다 → 같은 파일은 한 번만 저장 */
export async function putFile(buf: Uint8Array, ext: string): Promise<{ key: string; sha256: string }> {
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const key = `${sha256}.${safeExt}`;
  if (s3Enabled()) {
    const { client, bucket } = s3Client();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey(key), Body: buf }));
    return { key, sha256 };
  }
  await mkdir(join(root(), "attachments"), { recursive: true });
  await writeFile(join(root(), "attachments", key), buf);
  return { key, sha256 };
}

export async function getFile(key: string): Promise<Uint8Array> {
  if (!/^[a-f0-9]{64}\.[a-z0-9]{1,8}$/.test(key)) throw new Error("잘못된 파일 키");
  if (s3Enabled()) {
    const { client, bucket } = s3Client();
    const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey(key) }));
    if (!r.Body) throw new Error("빈 파일");
    return r.Body.transformToByteArray();
  }
  return new Uint8Array(await readFile(join(root(), "attachments", key)));
}
