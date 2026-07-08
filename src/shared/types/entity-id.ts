import { randomUUID } from "node:crypto";

export function createId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.() ?? randomUUID();

  return `${prefix}_${uuid.replaceAll("-", "")}`;
}
