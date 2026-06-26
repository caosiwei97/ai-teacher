import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt, maskApiKey } from "./crypto";

const VALID_KEY = "a".repeat(64); // 64 字符 hex（32 字节）

describe("crypto", () => {
  beforeEach(() => {
    process.env.LLM_ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    delete process.env.LLM_ENCRYPTION_KEY;
  });

  describe("encrypt / decrypt 往返", () => {
    it("加密后解密还原原文", () => {
      const plaintext = "sk-abc-123-456-789";
      const encrypted = encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it("同一明文多次加密产生不同密文（IV 随机）", () => {
      const a = encrypt("same-secret");
      const b = encrypt("same-secret");
      expect(a).not.toBe(b);
      expect(decrypt(a)).toBe("same-secret");
      expect(decrypt(b)).toBe("same-secret");
    });

    it("中文与特殊字符往返", () => {
      const plaintext = "密钥🔑中文-special";
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it("密文格式为 iv:authTag:ciphertext 三段 base64", () => {
      const encrypted = encrypt("x");
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);
      // 每段都能 base64 解码
      parts.forEach((p) => {
        expect(() => Buffer.from(p, "base64")).not.toThrow();
      });
    });
  });

  describe("decrypt 错误处理", () => {
    it("格式非法（非三段）抛错", () => {
      expect(() => decrypt("not-a-valid-format")).toThrow(/Invalid encrypted format/);
    });

    it("缺少 LLM_ENCRYPTION_KEY 抛错", () => {
      delete process.env.LLM_ENCRYPTION_KEY;
      expect(() => encrypt("x")).toThrow(/LLM_ENCRYPTION_KEY is not set/);
    });

    it("key 格式非法抛错", () => {
      process.env.LLM_ENCRYPTION_KEY = "too-short";
      expect(() => encrypt("x")).toThrow(/64-character hex/);
    });
  });

  describe("maskApiKey", () => {
    it("长 key 保留首 3 尾 4", () => {
      expect(maskApiKey("sk-abcdefghij123456")).toBe("sk-***...3456");
    });

    it("短 key（≤7）返回 ***", () => {
      expect(maskApiKey("short")).toBe("***");
      expect(maskApiKey("1234567")).toBe("***");
    });

    it("边界 length=8 正常 mask", () => {
      expect(maskApiKey("12345678")).toBe("123***...5678");
    });
  });
});
