// 파일 저장소. 지금은 로컬 디스크(STORAGE_DIR, 기본 ./storage). S3 호환은 배포할 때
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = () => resolve(process.env.STORAGE_DIR?.trim() || "storage");

/** 내용 해시로 이름을 정한다 → 같은 파일은 한 번만 저장 */
export async function putFile(buf: Uint8Array, ext: string): Promise<{ key: string; sha256: string }> {
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const key = `${sha256}.${safeExt}`;
  await mkdir(join(root(), "attachments"), { recursive: true });
  await writeFile(join(root(), "attachments", key), buf);
  return { key, sha256 };
}

export async function getFile(key: string): Promise<Uint8Array> {
  if (!/^[a-f0-9]{64}\.[a-z0-9]{1,8}$/.test(key)) throw new Error("잘못된 파일 키");
  return new Uint8Array(await readFile(join(root(), "attachments", key)));
}
