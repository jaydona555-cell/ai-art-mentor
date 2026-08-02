import { createFileRoute } from "@tanstack/react-router";

import {
  AI_DETECTION_PROMPT,
  FOLLOWUP_PROMPT,
  MASTERPIECE_STYLE_PROMPT,
  OUTPUT_FORMAT,
  SYSTEM_PROMPT_BASE,
  buildMediumPrompt,
  parseAnalysisResponse,
} from "@/lib/atelier-ai.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TEXT_MODEL = "google/gemini-3.5-flash";
const IMAGE_MODEL = "google/gemini-3.1-flash-image";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: unknown;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function callGateway(
  body: Record<string, unknown>,
): Promise<{ ok: true; data: any } | { ok: false; status: number; message: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return { ok: false, status: 500, message: "AI is not configured on the server." };
  }

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[analyze-artwork] gateway error ${response.status}: ${text}`);
    if (response.status === 429) {
      return {
        ok: false,
        status: 429,
        message: "The analysis service is busy right now. Please wait a moment and try again.",
      };
    }
    if (response.status === 402) {
      return {
        ok: false,
        status: 402,
        message: "AI credits are exhausted. Please add credits to continue.",
      };
    }
    return { ok: false, status: 502, message: text.slice(0, 300) || "AI request failed." };
  }

  return { ok: true, data: await response.json() };
}

function imageMessage(imageBase64: string, mimeType: string | undefined, text: string) {
  return {
    role: "user" as const,
    content: [
      { type: "text", text },
      {
        type: "image_url",
        image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` },
      },
    ],
  };
}

function textOf(data: any): string {
  return typeof data?.choices?.[0]?.message?.content === "string"
    ? data.choices[0].message.content
    : "";
}

async function handlePost({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as Record<string, any>;

    // ---- Mode: Analyze style for masterpiece generation ----
    if (body.mode === "analyze-style") {
      if (!body.imageBase64) return json({ error: "No image provided" }, 400);
      const result = await callGateway({
        model: TEXT_MODEL,
        messages: [
          { role: "system", content: MASTERPIECE_STYLE_PROMPT },
          imageMessage(
            body.imageBase64,
            body.mimeType,
            "Describe the distinctive style of this artwork.",
          ),
        ],
      });
      if (!result.ok) return json({ error: result.message }, result.status);
      return json({
        styleDescription: textOf(result.data).trim() || "a beautiful artistic masterpiece",
      });
    }

    // ---- Mode: Generate Masterpiece ----
    if (body.mode === "generate-masterpiece") {
      const styleDescription = body.styleDescription || "a beautiful artistic masterpiece";
      const prompt = `Create a master-level artwork in the following style: ${styleDescription}. Make it breathtaking, gallery-worthy, and emotionally resonant. High quality, detailed.`;
      const result = await callGateway({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      });
      if (!result.ok) return json({ error: result.message }, result.status);

      const imageUrl = result.data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
      if (!imageUrl) return json({ error: "No image returned by the AI" }, 502);
      return json({ imageUrl, imageBase64: null, prompt });
    }

    // ---- Mode: Follow-up conversation ----
    if (body.mode === "followup") {
      const history: Array<{ role: string; content: string }> = body.history || [];
      const messages: ChatMessage[] = [
        { role: "system", content: FOLLOWUP_PROMPT },
        {
          role: "user",
          content: `Previous feedback context:\n${body.previousFeedback || ""}\n\nLet's discuss this further.`,
        },
        ...history.map((msg) => ({
          role: msg.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: msg.content,
        })),
      ];
      const result = await callGateway({ model: TEXT_MODEL, messages });
      if (!result.ok) return json({ error: result.message }, result.status);
      const feedback = textOf(result.data).trim();
      if (!feedback) return json({ error: "No response received from the AI" }, 502);
      return json({ feedback });
    }

    // ---- Mode: Artwork analysis (default) ----
    const { imageBase64, mimeType, preferredMedium, profilePrompt } = body;
    if (!imageBase64) return json({ error: "No image provided" }, 400);

    // Step 1: AI-generated art detection
    const detection = await callGateway({
      model: TEXT_MODEL,
      messages: [
        { role: "system", content: AI_DETECTION_PROMPT },
        imageMessage(
          imageBase64,
          mimeType,
          "Analyze this image and determine if it is AI-generated. Respond with only the JSON object.",
        ),
      ],
    });

    if (detection.ok) {
      const match = textOf(detection.data).match(/\{[\s\S]*?\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          // Only reject if there is high confidence AND concrete evidence
          if (parsed.aiGenerated === true && parsed.confidence === "high" && parsed.reason?.length > 10) {
            return json({ aiDetected: true, feedback: null });
          }
        } catch {
          /* proceed with analysis */
        }
      }
    }

    // Step 2: Main critique
    let systemPrompt = SYSTEM_PROMPT_BASE;
    if (preferredMedium && preferredMedium !== "none") {
      systemPrompt += buildMediumPrompt(preferredMedium);
    }
    if (profilePrompt && typeof profilePrompt === "string") {
      systemPrompt += `\n\n${profilePrompt}`;
    }
    systemPrompt += OUTPUT_FORMAT;

    const analysis = await callGateway({
      model: TEXT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        imageMessage(
          imageBase64,
          mimeType,
          "Please analyze my artwork and respond with only the JSON object.",
        ),
      ],
      response_format: { type: "json_object" },
    });
    if (!analysis.ok) return json({ error: analysis.message }, analysis.status);

    const parsed = parseAnalysisResponse(textOf(analysis.data));
    if (!parsed) {
      return json(
        { error: "The AI response could not be parsed. Please try uploading your artwork again." },
        502,
      );
    }

    return json({
      aiDetected: false,
      feedback: parsed.critiqueText,
      skillLevel: parsed.skillLevel,
      mediumMatch: parsed.mediumMatch,
      isAnalog: parsed.isAnalog,
      experimentationLevel: parsed.experimentationLevel,
      critiquePins: parsed.critiquePins,
    });
  } catch (err) {
    console.error("[analyze-artwork] unexpected error", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
}

export const Route = createFileRoute("/api/analyze-artwork")({
  server: {
    handlers: {
      POST: handlePost,
    },
  },
});
