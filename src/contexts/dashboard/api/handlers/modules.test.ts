import { describe, it, expect, vi } from "vitest";
import { listModules, updateModuleState, type Module, type ModuleStore } from "./modules";

function createMockStore(modules: Module[]): ModuleStore {
  return {
    list: vi.fn().mockResolvedValue(modules),
    get: vi.fn().mockImplementation(async (id: string) => modules.find((m) => m.id === id) ?? null),
    updateState: vi.fn().mockImplementation(async (id: string, state: Module["state"]) => {
      const mod = modules.find((m) => m.id === id);
      if (!mod) return null;
      return { ...mod, state };
    }),
  };
}

describe("Dashboard API — Module Handler", () => {
  const sampleModules: Module[] = [
    { id: "mod-1", name: "AD Account Unlock", state: "enabled", confidenceThreshold: 85 },
    { id: "mod-2", name: "DNS Record", state: "disabled", confidenceThreshold: 90 },
  ];

  it("GET returns list of modules", async () => {
    const store = createMockStore(sampleModules);
    const result = await listModules(store);
    expect(result).toEqual(sampleModules);
    expect(store.list).toHaveBeenCalledOnce();
  });

  it("PATCH state with valid transition succeeds", async () => {
    const store = createMockStore(sampleModules);
    const result = await updateModuleState(store, "mod-1", "disabled", "team_lead");
    expect(result.success).toBe(true);
    expect(result.module?.state).toBe("disabled");
  });

  it("PATCH state with invalid transition fails", async () => {
    const store = createMockStore(sampleModules);
    // enabled → enabled is not a valid transition
    const result = await updateModuleState(store, "mod-1", "enabled", "team_lead");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid transition");
  });

  it("viewer role cannot modify (returns forbidden)", async () => {
    const store = createMockStore(sampleModules);
    const result = await updateModuleState(store, "mod-1", "disabled", "team_member");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Forbidden");
  });
});
