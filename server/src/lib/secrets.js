// API-key encryption at rest — AES-256-GCM.
// Key material: KEY_SECRET from .env if set, else derived from this machine's
// identity (hostname + username) — so a copied database file is useless
// elsewhere. GCM gives integrity too: tampered ciphertext fails to decrypt.
import crypto from "node:crypto";
import os from "node:os";

const keyMaterial = crypto
  .createHash("sha256")
  .update(process.env.KEY_SECRET || `${os.hostname()}:${os.userInfo().username}:careerpilot`)
  .digest();

export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyMaterial, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload) {
  const [iv, tag, data] = payload.split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyMaterial, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
