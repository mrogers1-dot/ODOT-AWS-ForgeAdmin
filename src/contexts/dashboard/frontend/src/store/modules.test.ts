import { describe, it, expect, beforeEach } from "vitest";
import { useModulesStore } from "./modules";

describe("Modules Store", () => {
  beforeEach(() => {
    useModulesStore.setState({ modules: [], loading: false, error: null });
  });

  it("setModules updates the list", () => {
    const modules = [
      { id: "m1", name: "AD Unlock", state: "enabled" as const, confidenceThreshold: 85 },
    ];
    useModulesStore.getState().setModules(modules);
    expect(useModulesStore.getState().modules).toEqual(modules);
    expect(useModulesStore.getState().loading).toBe(false);
  });

  it("updateModuleState changes specific module", () => {
    useModulesStore.setState({
      modules: [
        { id: "m1", name: "AD Unlock", state: "enabled", confidenceThreshold: 85 },
        { id: "m2", name: "DNS Fix", state: "enabled", confidenceThreshold: 90 },
      ],
    });

    useModulesStore.getState().updateModuleState("m1", "disabled");

    expect(useModulesStore.getState().modules[0].state).toBe("disabled");
    expect(useModulesStore.getState().modules[1].state).toBe("enabled");
  });

  it("RBAC: viewer role sees module data (store is role-agnostic)", () => {
    // Store itself doesn't enforce RBAC — that's at API layer
    useModulesStore.getState().setModules([
      { id: "m1", name: "Test", state: "shadow", confidenceThreshold: 70 },
    ]);
    expect(useModulesStore.getState().modules).toHaveLength(1);
  });
});
