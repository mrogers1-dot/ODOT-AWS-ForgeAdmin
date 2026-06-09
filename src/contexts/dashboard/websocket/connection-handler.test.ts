import { describe, it, expect, vi } from "vitest";
import { handleConnect, handleDisconnect, fanOut, type ConnectionStore, type SendFn } from "./connection-handler";

function createMockStore(): ConnectionStore & { connections: string[] } {
  const connections: string[] = [];
  return {
    connections,
    add: vi.fn().mockImplementation(async (id: string) => { connections.push(id); }),
    remove: vi.fn().mockImplementation(async (id: string) => {
      const idx = connections.indexOf(id);
      if (idx >= 0) connections.splice(idx, 1);
    }),
    getAll: vi.fn().mockImplementation(async () => [...connections]),
  };
}

describe("WebSocket Connection Handler", () => {
  it("connect stores connection ID", async () => {
    const store = createMockStore();
    await handleConnect("conn-1", store);
    expect(store.add).toHaveBeenCalledWith("conn-1");
    expect(store.connections).toContain("conn-1");
  });

  it("disconnect removes connection ID", async () => {
    const store = createMockStore();
    store.connections.push("conn-1");
    await handleDisconnect("conn-1", store);
    expect(store.remove).toHaveBeenCalledWith("conn-1");
    expect(store.connections).not.toContain("conn-1");
  });

  it("fan-out sends to all active connections", async () => {
    const store = createMockStore();
    store.connections.push("conn-1", "conn-2", "conn-3");
    const send: SendFn = vi.fn().mockResolvedValue(undefined);

    const sent = await fanOut(store, { event: "update" }, send);

    expect(sent).toBe(3);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenCalledWith("conn-1", { event: "update" });
    expect(send).toHaveBeenCalledWith("conn-2", { event: "update" });
    expect(send).toHaveBeenCalledWith("conn-3", { event: "update" });
  });
});
