export interface SkillDoc {
  id: string;
  title: string;
  content: string;
  scope: "global" | "agent-specific";
  targetAgent?: string;
}

export interface ISkillSteeringProvider {
  getDocsForAgent(agentName: string, tokenBudget: number): Promise<SkillDoc[]>;
}
