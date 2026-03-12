import type { Express } from "express";
import type { Server } from "http";
import { batchLetterRequestSchema } from "@shared/schema";
import { parseJsonSafe } from "@shared/utils";

async function callClaude(system: string, userMessage: string, maxTokens: number = 2000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as any;
  return data.content[0].text;
}

async function callSonar(system: string, userMessage: string, maxTokens: number = 1500): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sonar API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as any;
  return data.choices[0].message.content;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      perplexity: !!process.env.PERPLEXITY_API_KEY,
      postgrid: !!process.env.POSTGRID_API_KEY,
    });
  });

  app.post("/api/sonar", async (req, res) => {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "PERPLEXITY_API_KEY not set" });

    const { system, user, maxTokens = 1500 } = req.body;
    if (!system || !user) return res.status(400).json({ error: "system and user prompts required" });

    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: `Sonar ${response.status}: ${text}` });
      }

      const data = (await response.json()) as any;
      res.json({ content: data.choices[0].message.content });
    } catch (e: any) {
      console.error("Sonar proxy error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/bills/search", async (req, res) => {
    const {
      subject,
      level = "federal",
      state,
      count = "3",
    } = req.query as Record<string, string>;
    if (!subject)
      return res.status(400).json({ error: "subject parameter required" });

    try {
      const scope = `${level} level${state ? ` in ${state}` : ""}`;
      const raw = await callSonar(
        "You are a US legislative research assistant. Return ONLY a JSON array of bills. Each bill should have: bill_id, title, summary (1-2 sentences), status, url (congress.gov or legiscan URL), sponsor (name). Return real, verifiable bills only. No markdown, just JSON array.",
        `Search for up to ${count} recent or active bills related to '${subject}' at the ${scope}. Return a JSON array.`,
        2000,
      );
      const parsed = parseJsonSafe(raw);
      const numCount = parseInt(count) || 3;
      if (parsed && Array.isArray(parsed)) {
        res.json(parsed.slice(0, numCount));
      } else if (parsed && parsed.bills) {
        res.json(parsed.bills.slice(0, numCount));
      } else {
        res.json([]);
      }
    } catch (e: any) {
      console.error("Bills search error:", e);
      res.json([]);
    }
  });

  app.post("/api/letter/batch", async (req, res) => {
    const parseResult = batchLetterRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res
        .status(400)
        .json({ error: "Invalid request", details: parseResult.error });
    }

    const {
      subject,
      sender_name,
      reps,
      sender_role,
      sender_experience,
      impact_outcome,
      impact_stakeholder,
      impact_reason,
      impact_difference,
      impact_research,
      manual_bill_text,
    } = parseResult.data;

    const results: Record<string, string> = {};

    for (const rep of reps) {
      try {
        const repName = rep.name || "Unknown";
        const chamber = rep.chamber || "";
        const party = rep.party || "";
        const repState = rep.state || "";
        const district = rep.district || "";

        let billContext = "";
        if (manual_bill_text) {
          billContext = `\nRelevant legislation: ${manual_bill_text}`;
        } else if (rep.bill_id) {
          billContext = `\nRelevant bill: ${rep.bill_id} — ${rep.bill_title || ""}\nBill summary: ${rep.bill_summary || ""}`;
        }

        let senderContext = "";
        if (sender_role) senderContext += `\nSender's role: ${sender_role}`;
        if (sender_experience)
          senderContext += `\nSender's experience: ${sender_experience}`;

        let impactContext = "";
        if (impact_outcome)
          impactContext += `\nDesired outcome: ${impact_outcome}`;
        if (impact_stakeholder)
          impactContext += `\nAffected stakeholders: ${impact_stakeholder}`;
        if (impact_reason)
          impactContext += `\nWhy it matters: ${impact_reason}`;
        if (impact_difference)
          impactContext += `\nWhat difference action would make: ${impact_difference}`;
        if (impact_research)
          impactContext += `\nSupporting research: ${impact_research}`;

        let addressLine = "";
        if (rep.return_address) {
          addressLine = `\nReturn address: ${rep.return_address}`;
        }

        const isSenate = chamber.includes("Senate");
        const salutation = isSenate ? "Senator" : "Representative";
        const lastName = repName.split(" ").pop() || "Unknown";

        const raw = await callClaude(
          "You are a skilled constituent letter writer. Write a professional, persuasive letter to an elected official on behalf of a constituent. The letter should be:\n- Professional and respectful\n- Specific to the representative's position and jurisdiction\n- Include concrete details and data when available\n- Reference relevant legislation if provided\n- Be 200-350 words\n- End with a clear call to action\nReturn ONLY the letter text, no markdown formatting or extra notes.",
          `Write a letter from ${sender_name} to ${salutation} ${lastName} (${party}, ${chamber}, ${repState}${district ? ", " + district : ""}) about: ${subject}${senderContext}${impactContext}${billContext}${addressLine}\n\nSign the letter as ${sender_name}.`,
          1500,
        );
        results[repName] = raw.trim();
      } catch (e: any) {
        console.error(`Letter generation error for ${rep.name}:`, e);
        const isSenate = (rep.chamber || "").includes("Senate");
        const sal = isSenate ? "Senator" : "Representative";
        const ln = (rep.name || "").split(" ").pop() || "Official";
        results[rep.name || "Unknown"] =
          `Dear ${sal} ${ln},\n\nAs a constituent, I am writing to urge your attention to ${subject}.\n\nThis issue directly impacts families and communities in ${rep.state || "our state"}. I believe meaningful action on this matter is both necessary and timely.\n\nI respectfully ask that you prioritize this issue and take action to address it.\n\nI look forward to hearing from you.\n\nSincerely,\n${sender_name}`;
      }
    }

    res.json(results);
  });

  app.post("/api/postgrid/send", async (req, res) => {
    const postgridKey = process.env.POSTGRID_API_KEY;
    if (!postgridKey)
      return res.json({ error: "POSTGRID_API_KEY not configured" });

    const {
      to_name,
      to_organization,
      to_address_line1,
      to_address_line2,
      to_city,
      to_state,
      to_zip,
      from_name,
      from_address_line1,
      from_address_line2,
      from_city,
      from_state,
      from_zip,
      letter_html,
      description,
    } = req.body;

    try {
      const resp = await fetch(
        "https://api.postgrid.com/print-mail/v1/letters",
        {
          method: "POST",
          headers: {
            "x-api-key": postgridKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: {
              firstName: to_name?.split(" ")[0] || "",
              lastName: to_name?.split(" ").slice(1).join(" ") || "",
              companyName: to_organization || "",
              addressLine1: to_address_line1,
              addressLine2: to_address_line2 || "",
              city: to_city,
              provinceOrState: to_state,
              postalOrZip: to_zip,
              country: "US",
            },
            from: {
              firstName: from_name?.split(" ")[0] || "",
              lastName: from_name?.split(" ").slice(1).join(" ") || "",
              addressLine1: from_address_line1 || "",
              addressLine2: from_address_line2 || "",
              city: from_city || "",
              provinceOrState: from_state || "",
              postalOrZip: from_zip ||
