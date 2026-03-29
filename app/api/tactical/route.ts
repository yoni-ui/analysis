import { NextResponse } from "next/server";
import { mockTacticalAnalysis } from "@/lib/ai/mock";
import { buildTacticalPayload, GEMINI_SYSTEM, GROQ_SYSTEM } from "@/lib/ai/prompts";
import type { RunSummary } from "@/lib/simulation/types";
import type { ScenarioParams } from "@/lib/simulation/types";
import type { TacticalAnalysis } from "@/lib/ai/types";

export const runtime = "nodejs";

async function geminiMarkdownAddendum(user: string): Promise<string | null> {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: GEMINI_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text ?? null;
  } catch {
    return null;
  }
}

async function groqAnalyze(
  scenario: ScenarioParams,
  run: RunSummary
): Promise<TacticalAnalysis | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const user = JSON.stringify(buildTacticalPayload(scenario, run));
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [
        { role: "system", content: GROQ_SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as TacticalAnalysis;
    if (
      typeof parsed.interceptionProbability !== "number" ||
      !parsed.riskLevel ||
      typeof parsed.briefing !== "string"
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      scenario?: ScenarioParams;
      run?: RunSummary;
    };
    if (!body.scenario || !body.run) {
      return NextResponse.json({ error: "scenario and run required" }, { status: 400 });
    }
    let ai = await groqAnalyze(body.scenario, body.run);
    let source: "groq" | "mock" = "mock";
    if (ai) {
      source = "groq";
    } else {
      ai = mockTacticalAnalysis(body.scenario, body.run);
    }
    const userPayload = JSON.stringify(buildTacticalPayload(body.scenario, body.run));
    const gemini = await geminiMarkdownAddendum(
      `${userPayload}\n\nExisting JSON briefing (integrate, do not contradict): ${JSON.stringify(ai)}`
    );
    if (gemini) {
      ai = {
        ...ai,
        briefing: `${ai.briefing}\n\n---\n${gemini.slice(0, 1200)}`,
      };
    }
    return NextResponse.json({ analysis: ai, source: gemini ? `${source}+gemini` : source });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}
