// 연결 키: .env가 먼저, 없으면 화면에서 넣어 DB에 암호화해 둔 값.
// server-only를 붙이지 않는다: 워커·tsx 스크립트에서도 쓴다. 클라이언트 컴포넌트에서 import 금지
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const SECRET_NAMES = ["ANTHROPIC_API_KEY", "SLACK_WEBHOOK_URL", "BIZINFO_API_KEY", "DATA_GO_KR_SERVICE_KEY"] as const;
export type SecretName = (typeof SECRET_NAMES)[number];
export const isSecretName = (v: string): v is SecretName => (SECRET_NAMES as readonly string[]).includes(v);

type Stored = { value: string | null; last4: string; updatedAt: Date; broken: boolean };
// 개발 중 HMR·번들마다 모듈이 따로 떠도 같은 값을 보도록 전역에 둔다
const g = globalThis as unknown as { __secrets?: { map: Map<SecretName, Stored>; loadedAt: number } };
const RELOAD_MS = 60_000;

function cryptoKey() {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s) throw new Error("AUTH_SECRET이 없어 키를 암호화할 수 없어요");
  return createHash("sha256").update(`grant-desk:secrets:${s}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cryptoKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

/** 복호화 실패(AUTH_SECRET이 바뀜 등)면 null */
export function decryptSecret(ciphertext: string): string | null {
  try {
    const [iv, tag, data] = ciphertext.split(".").map((p) => Buffer.from(p, "base64"));
    const d = createDecipheriv("aes-256-gcm", cryptoKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const last4 = (v: string) => v.trim().slice(-4);

const fromEnv = (name: SecretName) => process.env[name]?.trim() || null;

/** 지금 쓸 값 (동기). .env → DB 캐시. 캐시는 ensureSecrets()가 채운다 */
export function secret(name: SecretName): string | null {
  return fromEnv(name) ?? g.__secrets?.map.get(name)?.value ?? null;
}

/** DB 값을 캐시에 읽어 둔다. force가 아니면 1분에 한 번만 */
export async function ensureSecrets(force = false): Promise<void> {
  if (!force && g.__secrets && Date.now() - g.__secrets.loadedAt < RELOAD_MS) return;
  const { prisma } = await import("@/server/db");
  const rows = await prisma.appSecret.findMany();
  const map = new Map<SecretName, Stored>();
  for (const r of rows) {
    if (!isSecretName(r.name)) continue;
    const value = decryptSecret(r.ciphertext);
    map.set(r.name, { value, last4: r.last4, updatedAt: r.updatedAt, broken: value === null });
  }
  g.__secrets = { map, loadedAt: Date.now() };
}

export type SecretStatus = { name: SecretName; source: "env" | "db" | "none"; last4: string | null; updatedAt: Date | null; broken: boolean };

/** 화면 표시용 (값은 내보내지 않는다) */
export async function secretStatuses(): Promise<Record<SecretName, SecretStatus>> {
  await ensureSecrets(true);
  const out = {} as Record<SecretName, SecretStatus>;
  for (const name of SECRET_NAMES) {
    const env = fromEnv(name);
    const db = g.__secrets?.map.get(name);
    out[name] = env
      ? { name, source: "env", last4: last4(env), updatedAt: null, broken: false }
      : db
        ? { name, source: "db", last4: db.last4, updatedAt: db.updatedAt, broken: db.broken }
        : { name, source: "none", last4: null, updatedAt: null, broken: false };
  }
  return out;
}

export async function storeSecret(name: SecretName, value: string, userId: string | null) {
  const { prisma } = await import("@/server/db");
  const v = value.trim();
  const data = { ciphertext: encryptSecret(v), last4: last4(v), updatedById: userId };
  await prisma.appSecret.upsert({ where: { name }, create: { name, ...data }, update: data });
  await ensureSecrets(true);
}

export async function removeSecret(name: SecretName) {
  const { prisma } = await import("@/server/db");
  await prisma.appSecret.deleteMany({ where: { name } });
  await ensureSecrets(true);
}
