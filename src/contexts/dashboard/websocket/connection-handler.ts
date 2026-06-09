export interface ConnectionStore {
  add(connectionId: string): Promise<void>;
  remove(connectionId: string): Promise<void>;
  getAll(): Promise<string[]>;
}

export async function handleConnect(connectionId: string, store: ConnectionStore): Promise<void> {
  await store.add(connectionId);
}

export async function handleDisconnect(connectionId: string, store: ConnectionStore): Promise<void> {
  await store.remove(connectionId);
}

export type SendFn = (connectionId: string, data: unknown) => Promise<void>;

export async function fanOut(store: ConnectionStore, data: unknown, send: SendFn): Promise<number> {
  const connections = await store.getAll();
  let sent = 0;
  for (const connId of connections) {
    try {
      await send(connId, data);
      sent++;
    } catch {
      // Stale connection — remove it
      await store.remove(connId);
    }
  }
  return sent;
}
