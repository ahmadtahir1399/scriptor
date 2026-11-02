import "server-only";

import { completeStructured } from "@/lib/ai/complete";
import type { UsageAttribution } from "@/lib/ai/tokenUsage";
import {
  EXTRACTION_LIMITS,
  normaliseCategory,
  type RequirementCategory,
} from "@/lib/requirements/config";
import { llmRequirementsResponseSchema } from "@/lib/validations/requirement";

/**
 * Turns a guidelines document into discrete, checkable requirements.
 *
 * The single model call in the extraction pipeline. Its whole job is to split a
 * faculty rulebook into ATOMIC rules — "the abstract must be 150–300 words" and
 * "the abstract must include keywords" are two requirements, not one — each with
 * a category, a verbatim source quote (so the student recognises their own
 * rulebook), and a mandatory/optional flag.
 *
 * SECURITY: this prompt receives ONLY the guidelines document. The student's
 * thesis never enters it — a requirement is applied to the thesis later, in a
 * separate job, with a separate prompt. The two document contexts never mix.
 */

export interface ExtractedRequirement {
  title: string;
  description: string;
  category: RequirementCategory;
  sourceQuote: string;
  isMandatory: boolean;
}

const SYSTEM = `You convert a university or journal guidelines document into a checklist of discrete, individually-checkable requirements.

Rules:
- Each requirement is ONE atomic, testable rule. Split compound rules: "the abstract must be 150–300 words and include keywords" is TWO requirements.
- Give each a short imperative "title" (the rule itself) and an optional "description" with any detail.
- "category" must be exactly one of: Formatting, Structure, Citation, Content, Length, Language, Other.
- "source_quote" MUST be copied VERBATIM from the guidelines — the sentence the rule comes from. If you cannot quote it, omit the requirement.
- "is_mandatory": true for "must"/"required"/"shall"; false for "should"/"recommended"/"may".
- Extract rules about margins, font, spacing and physical layout too — they are still real requirements. Do not judge whether they are automatically checkable; that is decided elsewhere.
- Deduplicate near-identical rules. Preserve the source's own phrasing.
- Never invent a rule the document does not state.

Return a JSON object: { "requirements": [ { "title", "description", "category", "source_quote", "is_mandatory" } ] }. Return JSON only.`;

export async function extractRequirements(args: {
  guidelineText: string;
  attribution: UsageAttribution;
}): Promise<ExtractedRequirement[]> {
  // SECURITY: only the guidelines text is sent — never the student's thesis.
  const text = args.guidelineText.slice(0, EXTRACTION_LIMITS.maxGuidelineChars);

  const result = await completeStructured({
    role: "EXTRACTION",
    system: SYSTEM,
    user: text,
    schema: llmRequirementsResponseSchema,
    schemaName: "requirementExtraction",
    attribution: args.attribution,
    temperature: 0,
    maxOutputTokens: EXTRACTION_LIMITS.maxOutputTokens,
  });

  const seen = new Set<string>();
  const requirements: ExtractedRequirement[] = [];

  for (const requirement of result.data.requirements) {
    const key = requirement.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    requirements.push({
      title: requirement.title,
      description: requirement.description,
      category: normaliseCategory(requirement.category),
      sourceQuote: requirement.source_quote,
      isMandatory: requirement.is_mandatory,
    });

    if (requirements.length >= EXTRACTION_LIMITS.maxRequirements) break;
  }

  return requirements;
}
