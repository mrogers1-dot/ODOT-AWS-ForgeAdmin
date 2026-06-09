export interface ModuleState {
  moduleId: string;
  state: "enabled" | "disabled" | "shadow";
  gracePeriodEndsAt?: string;
}

export interface StateTransitionResult {
  success: boolean;
  newState?: ModuleState;
  error?: string;
  gracePeriodStarted?: boolean;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  enabled: ["disabled", "shadow"],
  disabled: ["enabled", "shadow"],
  shadow: ["enabled", "disabled"],
};

const GRACE_PERIOD_MS = 300_000; // 300 seconds

export function transitionState(
  current: ModuleState,
  target: "enabled" | "disabled" | "shadow",
): StateTransitionResult {
  if (!VALID_TRANSITIONS[current.state]?.includes(target)) {
    return { success: false, error: `Invalid transition: ${current.state} → ${target}` };
  }

  const gracePeriodStarted = target === "disabled" && current.state === "enabled";
  const gracePeriodEndsAt = gracePeriodStarted
    ? new Date(Date.now() + GRACE_PERIOD_MS).toISOString()
    : undefined;

  return {
    success: true,
    newState: { moduleId: current.moduleId, state: target, gracePeriodEndsAt },
    gracePeriodStarted,
  };
}

export function isGracePeriodExpired(state: ModuleState): boolean {
  if (!state.gracePeriodEndsAt) return false;
  return new Date().toISOString() >= state.gracePeriodEndsAt;
}
