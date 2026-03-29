export interface TacticalAnalysis {
  interceptionProbability: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  briefing: string;
  recommendations: { title: string; detail: string }[];
}
