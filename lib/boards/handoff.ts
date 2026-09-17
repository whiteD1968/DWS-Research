export type BoardHandoffSource = { type: "collection" | "discover"; id: string };
export type BoardTransfer = { id: string; keys: string[] };
export function parseTransfer(add: string | undefined, transfer: string | undefined): BoardTransfer | undefined {
  if (typeof add !== "string" || typeof transfer !== "string" || !add || !transfer) return;
  const keys = [...new Set(add.split(","))];
  if (!/^[\da-f-]{36}$/i.test(transfer) || keys.length > 100 || !keys.length || keys.some(key => !/^reference:[\da-f-]{36}$/i.test(key))) return;
  return { id: transfer, keys };
}
