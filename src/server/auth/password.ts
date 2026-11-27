// 비밀번호 해시 (node:crypto scrypt). 형식: scrypt$<N>$<salt b64url>$<hash b64url>
// 테스트에서도 쓰므로 server-only를 붙이지 않는다
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 16384;
const KEYLEN = 32;

function derive(password: string, salt: Buffer, n: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: n, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N);
  return `scrypt$${N}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [algo, n, salt, hash] = stored?.split("$") ?? [];
  if (algo !== "scrypt" || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await derive(password, Buffer.from(salt, "base64url"), Number(n));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** 소속 회사 이름 비교용: (주)·주식회사·㈜·공백·기호를 빼고 소문자로 */
export function normalizeCompanyName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/주식회사|\(주\)|㈜|\(유\)|유한회사|co\.?,?\s*ltd\.?|inc\.?|corp\.?/gi, "")
    .replace(/[\s()[\]{}.,·\-_'"]/g, "")
    .toLowerCase();
}
