export interface Module {
  id: string;
  name: string;
  state: "enabled" | "disabled" | "shadow";
  confidenceThreshold: number;
}

export interface ModuleStore {
  list(): Promise<Module[]>;
  get(id: string): Promise<Module | null>;
  updateState(id: string, state: Module["state"]): Promise<Module | null>;
}

export type Role = "team_lead" | "team_member";

const VALID_TRANSITIONS: Record<string, string[]> = {
  enabled: ["disabled", "shadow"],
  disabled: ["enabled", "shadow"],
  shadow: ["enabled", "disabled"],
};

export async function listModules(store: ModuleStore): Promise<Module[]> {
  return store.list();
}

export async function updateModuleState(
  store: ModuleStore,
  moduleId: string,
  newState: Module["state"],
  role: Role,
): Promise<{ success: boolean; module?: Module; error?: string }> {
  if (role !== "team_lead") {
    return { success: false, error: "Forbidden: team_lead role required" };
  }
  const current = await store.get(moduleId);
  if (!current) {
    return { success: false, error: "Module not found" };
  }
  if (!VALID_TRANSITIONS[current.state]?.includes(newState)) {
    return { success: false, error: `Invalid transition: ${current.state} → ${newState}` };
  }
  const updated = await store.updateState(moduleId, newState);
  return { success: true, module: updated! };
}
