export const GUARDRAILS = `You are the drafting assistant for THE UNIVERSE STORE ("Everything Worth Discovering."), an affiliate product-discovery site serving Nigeria and international visitors.
STRICT RULES:
- Use ONLY the facts supplied in the input. Never invent prices, discounts, stock, delivery dates, ratings, review counts, specifications, awards or testimonials.
- Never claim you visited, tested, owned or verified a product or a retailer page.
- No unsupported superlatives ("best", "#1", "guaranteed"), no fake urgency or scarcity, no medical, financial or safety claims.
- Label every assumption. If a fact is missing, list it under missing facts instead of guessing.
- Refuse to promote alcohol, tobacco/nicotine, vaping, drugs, weapons, ammunition, explosives, gambling, adult sexual products, counterfeit goods or hazardous substances; set "blocked" to true and explain.
- Tone must be honest and helpful. Content that includes affiliate links must carry a clear disclosure.
Return ONLY valid JSON matching the requested shape, no markdown fences.`;

export const FORMATS: Record<string, string> = {
  product_description: "a neutral product description (80-140 words) for the product page",
  seo_meta: "an SEO title (max 60 chars) and meta description (max 155 chars); put them on two lines 'Title: ...' and 'Meta: ...'",
  category_intro: "a short, useful category introduction (60-100 words)",
  guide_outline: "a buying-guide outline with selection criteria, sections and what facts are still needed",
  social_caption: "short social captions: one each for TikTok, Instagram and Facebook, each ending with a clear affiliate disclosure line",
  video_script: "a 30-45 second short-form video script with hook, 3 beats and a call to action plus a spoken affiliate disclosure",
  carousel: "carousel copy: 5-7 slides, one short line each, final slide with disclosure",
  newsletter: "a short email/newsletter section (100-160 words) with disclosure",
  campaign_concept: "2-3 campaign concepts with angle, channels and content ideas",
};

export const TONES = ["informative", "concise", "friendly", "editorial"] as const;

export function draftPrompt(format: string, tone: string, facts: unknown, extra?: string) {
  return `Write ${FORMATS[format] || format}. Tone: ${tone}.
${extra ? `Owner notes: ${extra}\n` : ""}SUPPLIED PRODUCT FACTS (the only facts you may use):
${JSON.stringify(facts, null, 2)}

Respond with JSON: {"title": string, "body": string, "source_facts_used": string[], "needs_human_verification": string[], "missing_facts": string[], "assumptions": string[], "blocked": boolean, "blocked_reason": string|null}`;
}

export function researchPrompt(raw: string, categories: string[]) {
  return `The owner pasted the material below into the research inbox. You did NOT visit any URL; treat URLs as text only.
Available categories: ${categories.join(", ") || "(none yet)"}.
MATERIAL:
"""
${raw.slice(0, 6000)}
"""
Respond with JSON: {"summary": string, "suggested_title": string|null, "suggested_category": string|null, "draft_description": string|null, "sourced_facts": string[] (only facts literally present in the material), "suggestions": string[] (your ideas, clearly not facts), "missing_fields": string[], "guide_angle": string|null, "blocked": boolean, "blocked_reason": string|null}`;
}

export function parseJsonLoose(text: string): any | null {
  const t = text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch { /* fallthrough */ }
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { return null; } }
  return null;
}
