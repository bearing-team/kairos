import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, last4, secret } from "./secrets";

const prev = { auth: process.env.AUTH_SECRET, slack: process.env.SLACK_WEBHOOK_URL };
afterEach(() => {
  process.env.AUTH_SECRET = prev.auth;
  process.env.SLACK_WEBHOOK_URL = prev.slack;
});

describe("secrets", () => {
  it("암호화한 값을 같은 AUTH_SECRET으로 되돌린다 (매번 다른 암호문)", () => {
    process.env.AUTH_SECRET = "test-secret-a";
    const a = encryptSecret("sk-ant-1234abcd");
    const b = encryptSecret("sk-ant-1234abcd");
    expect(a).not.toBe(b);
    expect(a).not.toContain("1234abcd");
    expect(decryptSecret(a)).toBe("sk-ant-1234abcd");
  });

  it("AUTH_SECRET이 바뀌거나 암호문이 깨지면 null", () => {
    process.env.AUTH_SECRET = "test-secret-a";
    const c = encryptSecret("value");
    process.env.AUTH_SECRET = "test-secret-b";
    expect(decryptSecret(c)).toBeNull();
    expect(decryptSecret("garbage")).toBeNull();
  });

  it(".env 값이 먼저다", () => {
    process.env.SLACK_WEBHOOK_URL = "  https://hooks.slack.com/services/T/B/x  ";
    expect(secret("SLACK_WEBHOOK_URL")).toBe("https://hooks.slack.com/services/T/B/x");
    process.env.SLACK_WEBHOOK_URL = "";
    expect(secret("SLACK_WEBHOOK_URL")).toBeNull();
  });

  it("끝 4자리", () => {
    expect(last4(" abcdefgh ")).toBe("efgh");
  });
});
