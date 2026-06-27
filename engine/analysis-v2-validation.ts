import {
  ANALYSIS_V2_FIX_TARGETS,
  ANALYSIS_V2_HOOK_DECISIONS,
  ANALYSIS_V2_LIMITS,
  ANALYSIS_V2_SCENE_STATUSES,
  ANALYSIS_V2_SCRIPT_TYPES,
  ANALYSIS_V2_SEVERITIES,
  ANALYSIS_V2_VERDICTS,
  type AnalysisV2FixTarget,
  type AnalysisV2HookDecision,
  type AnalysisV2Result,
  type AnalysisV2RiskyPart,
  type AnalysisV2Scene,
  type AnalysisV2SceneStatus,
  type AnalysisV2ScriptType,
  type AnalysisV2Severity,
  type AnalysisV2SuggestedFix,
  type AnalysisV2Verdict,
} from "./analysis-v2-schema";

export type AnalysisV2InputValidation =
  | {
      ok: true;
      script: string;
      title: string;
    }
  | {
      ok: false;
      reason: string;
    };

export type AnalysisV2ResultValidation =
  | {
      ok: true;
      value: AnalysisV2Result;
    }
  | {
      ok: false;
      reason: string;
    };

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[]
): boolean {
  const allowed = new Set(allowedKeys);

  return Object.keys(value).every((key) => allowed.has(key));
}

function isNonEmptyBoundedString(
  value: unknown,
  maxCharacters: number
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxCharacters
  );
}

function isFiniteScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

function isEnumMember<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): value is T {
  return (
    typeof value === "string" &&
    (allowedValues as readonly string[]).includes(value)
  );
}

function isExactScriptSubstring(
  excerpt: string,
  script: string
): boolean {
  return excerpt.length > 0 && script.includes(excerpt);
}

function extractNumberTokens(value: string): string[] {
  return (value.match(/\d+(?:[.,]\d+)?%?/g) ?? []).map(
    (token) => token.replace(/,/g, "")
  );
}

function suggestedHookIntroducesNumber(
  suggestedHook: string,
  script: string
): boolean {
  const scriptNumbers = new Set(extractNumberTokens(script));

  return extractNumberTokens(suggestedHook).some(
    (number) => !scriptNumbers.has(number)
  );
}

function extractWordTokens(value: string): Set<string> {
  return new Set(
    (value.match(/\b[A-Za-z][A-Za-z0-9'-]*\b/g) ?? []).map(
      (token) => token.toLowerCase()
    )
  );
}

function extractPotentialNamedEntityTokens(
  value: string
): string[] {
  const matches = value.matchAll(
    /\b[A-Za-z][A-Za-z0-9'-]*\b/g
  );

  const entities: string[] = [];

  for (const match of matches) {
    const token = match[0];
    const index = match.index ?? 0;
    const precedingText = value
      .slice(0, index)
      .trimEnd();

    const isSentenceStart =
      precedingText.length === 0 ||
      /[.!?]["')\]]?$/.test(precedingText);

    const isAcronym =
      /^[A-Z]{2,}[A-Z0-9-]*$/.test(token);

    const hasInternalCapital =
      /[A-Z]/.test(token.slice(1)) &&
      /[a-z]/.test(token);

    const isMidSentenceCapitalized =
      /^[A-Z][a-z]/.test(token) &&
      !isSentenceStart;

    if (
      isAcronym ||
      hasInternalCapital ||
      isMidSentenceCapitalized
    ) {
      entities.push(token.toLowerCase());
    }
  }

  return entities;
}

function suggestedHookIntroducesNamedEntity(
  suggestedHook: string,
  script: string
): boolean {
  const scriptWords = extractWordTokens(script);

  return extractPotentialNamedEntityTokens(
    suggestedHook
  ).some((entity) => !scriptWords.has(entity));
}

const unsupportedClaimStrengthPatterns = [
  /\bconfirm(?:ed|s|ing|ation)?\b/i,
  /\bprov(?:e|es|ed|en|ing)\b/i,
  /\bguarantee(?:d|s|ing)?\b/i,
  /\b(?:ensure|ensures|ensured|ensuring)\b/i,
  /\bofficial(?:ly)?\b/i,
  /\bcompletely\b/i,
  /\bdefinitely\b/i,
  /\bwithout a doubt\b/i,
  /\b(?:scientists?|researchers?|experts?|doctors?|studies|research)\s+(?:say|says|show|shows|showed|confirm|confirms|confirmed|prove|proves|proved)\b/i,
] as const;

function suggestedHookIntroducesUnsupportedClaimStrength(
  suggestedHook: string,
  script: string
): boolean {
  return unsupportedClaimStrengthPatterns.some(
    (pattern) =>
      pattern.test(suggestedHook) &&
      !pattern.test(script)
  );
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function extractFirstSentence(script: string): string {
  const cleaned = normalizeWhitespace(script);

  if (cleaned.length === 0) {
    return "";
  }

  const sentenceEnd = cleaned.search(/[.!?](?:\s|$)/);

  return sentenceEnd === -1
    ? cleaned
    : cleaned.slice(0, sentenceEnd + 1).trim();
}

const genericFirstSentenceFillerPatterns = [
  /^(?:something|something interesting|something strange|something unusual|something surprising)\s+(?:happens|happened|is happening|will happen)\b/i,
  /^(?:there is|there's)\s+(?:something|one thing)\s+(?:interesting|strange|unusual|surprising)\b/i,
  /^(?:this|it)\s+is\s+something\s+(?:many|most)\s+people\b/i,
  /^(?:many|most)\s+people\s+(?:(?:have|probably have|may have)\s+)?(?:noticed|seen|heard)\b/i,
] as const;

function hasGenericFirstSentenceFiller(
  script: string
): boolean {
  const firstSentence = extractFirstSentence(script)
    .replace(/[.!?]+$/, "")
    .trim();

  return genericFirstSentenceFillerPatterns.some(
    (pattern) => pattern.test(firstSentence)
  );
}

function extractAnalysisV2OpeningWindow(
  script: string
): string {
  const cleaned = normalizeWhitespace(script);

  if (cleaned.length === 0) {
    return "";
  }

  const sentenceParts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const openingText =
    sentenceParts.length >= 2
      ? sentenceParts.slice(0, 2).join(" ")
      : cleaned;

  return openingText
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 35)
    .join(" ");
}

function riskyPartOverlapsOpening(
  excerpt: string,
  openingWindow: string,
  script: string
): boolean {
  const normalizedExcerpt =
    normalizeWhitespace(excerpt);
  const normalizedOpening =
    normalizeWhitespace(openingWindow);
  const normalizedScript =
    normalizeWhitespace(script);

  if (
    normalizedExcerpt.length === 0 ||
    normalizedOpening.length === 0 ||
    normalizedScript.length === 0
  ) {
    return false;
  }

  const openingEnd = normalizedOpening.length;
  let searchFrom = 0;

  while (
    searchFrom <=
    normalizedScript.length - normalizedExcerpt.length
  ) {
    const excerptStart = normalizedScript.indexOf(
      normalizedExcerpt,
      searchFrom
    );

    if (excerptStart === -1) {
      return false;
    }

    const excerptEnd =
      excerptStart + normalizedExcerpt.length;

    if (
      excerptStart < openingEnd &&
      excerptEnd > 0
    ) {
      return true;
    }

    searchFrom = excerptStart + 1;
  }

  return false;
}

export function validateAnalysisV2Input(
  script: unknown,
  title: unknown
): AnalysisV2InputValidation {
  if (typeof script !== "string") {
    return {
      ok: false,
      reason: "Script must be a string.",
    };
  }

  const normalizedScript = script.trim();

  if (normalizedScript.length === 0) {
    return {
      ok: false,
      reason: "A non-empty script must be provided.",
    };
  }

  if (
    normalizedScript.length >
    ANALYSIS_V2_LIMITS.maxScriptCharacters
  ) {
    return {
      ok: false,
      reason:
        "Script is too long. Keep it to 1,000 characters or less.",
    };
  }

  if (
    title !== undefined &&
    title !== null &&
    typeof title !== "string"
  ) {
    return {
      ok: false,
      reason: "Title must be a string.",
    };
  }

  const normalizedTitle =
    typeof title === "string" ? title.trim() : "";

  if (
    normalizedTitle.length >
    ANALYSIS_V2_LIMITS.maxTitleCharacters
  ) {
    return {
      ok: false,
      reason:
        "Title is too long. Keep it to 200 characters or less.",
    };
  }

  return {
    ok: true,
    script: normalizedScript,
    title: normalizedTitle,
  };
}

export function parseAnalysisV2Json(
  raw: string
): unknown | null {
  const normalized = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function validateRiskyPart(
  raw: unknown,
  script: string
):
  | {
      ok: true;
      value: AnalysisV2RiskyPart;
    }
  | {
      ok: false;
      reason: string;
    } {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      reason: "Each risky part must be an object.",
    };
  }

  if (
    !hasOnlyKeys(raw, [
      "excerpt",
      "reason",
      "severity",
    ])
  ) {
    return {
      ok: false,
      reason: "A risky part contains unsupported fields.",
    };
  }

  if (
    !isNonEmptyBoundedString(
      raw.excerpt,
      ANALYSIS_V2_LIMITS.maxScriptCharacters
    )
  ) {
    return {
      ok: false,
      reason: "A risky-part excerpt is missing or invalid.",
    };
  }

  if (!isExactScriptSubstring(raw.excerpt, script)) {
    return {
      ok: false,
      reason:
        "A risky-part excerpt is not an exact substring of the script.",
    };
  }

  if (
    !isNonEmptyBoundedString(
      raw.reason,
      ANALYSIS_V2_LIMITS.maxRiskReasonCharacters
    )
  ) {
    return {
      ok: false,
      reason: "A risky-part reason is missing or too long.",
    };
  }

  if (
    !isEnumMember(
      raw.severity,
      ANALYSIS_V2_SEVERITIES
    )
  ) {
    return {
      ok: false,
      reason: "A risky-part severity is invalid.",
    };
  }

  return {
    ok: true,
    value: {
      excerpt: raw.excerpt,
      reason: raw.reason.trim(),
      severity: raw.severity as AnalysisV2Severity,
    },
  };
}

function validateSuggestedFix(
  raw: unknown
):
  | {
      ok: true;
      value: AnalysisV2SuggestedFix;
    }
  | {
      ok: false;
      reason: string;
    } {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      reason: "Each suggested fix must be an object.",
    };
  }

  if (
    !hasOnlyKeys(raw, [
      "target",
      "suggestion",
      "optional",
    ])
  ) {
    return {
      ok: false,
      reason: "A suggested fix contains unsupported fields.",
    };
  }

  if (
    !isEnumMember(
      raw.target,
      ANALYSIS_V2_FIX_TARGETS
    )
  ) {
    return {
      ok: false,
      reason: "A suggested-fix target is invalid.",
    };
  }

  if (
    !isNonEmptyBoundedString(
      raw.suggestion,
      ANALYSIS_V2_LIMITS.maxFixSuggestionCharacters
    )
  ) {
    return {
      ok: false,
      reason:
        "A suggested-fix suggestion is missing or too long.",
    };
  }

  if (typeof raw.optional !== "boolean") {
    return {
      ok: false,
      reason:
        "A suggested fix must declare whether it is optional.",
    };
  }

  return {
    ok: true,
    value: {
      target: raw.target as AnalysisV2FixTarget,
      suggestion: raw.suggestion.trim(),
      optional: raw.optional,
    },
  };
}

function validateScene(
  raw: unknown,
  script: string
):
  | {
      ok: true;
      value: AnalysisV2Scene;
    }
  | {
      ok: false;
      reason: string;
    } {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      reason: "Each scene must be an object.",
    };
  }

  if (
    !hasOnlyKeys(raw, [
      "excerpt",
      "label",
      "status",
    ])
  ) {
    return {
      ok: false,
      reason: "A scene contains unsupported fields.",
    };
  }

  if (
    !isNonEmptyBoundedString(
      raw.excerpt,
      ANALYSIS_V2_LIMITS.maxScriptCharacters
    )
  ) {
    return {
      ok: false,
      reason: "A scene excerpt is missing or invalid.",
    };
  }

  if (!isExactScriptSubstring(raw.excerpt, script)) {
    return {
      ok: false,
      reason:
        "A scene excerpt is not an exact substring of the script.",
    };
  }

  if (
    !isNonEmptyBoundedString(
      raw.label,
      ANALYSIS_V2_LIMITS.maxSceneLabelCharacters
    )
  ) {
    return {
      ok: false,
      reason: "A scene label is missing or too long.",
    };
  }

  if (
    !isEnumMember(
      raw.status,
      ANALYSIS_V2_SCENE_STATUSES
    )
  ) {
    return {
      ok: false,
      reason: "A scene status is invalid.",
    };
  }

  return {
    ok: true,
    value: {
      excerpt: raw.excerpt,
      label: raw.label.trim(),
      status: raw.status as AnalysisV2SceneStatus,
    },
  };
}

export function validateAnalysisV2Result(
  raw: unknown,
  script: string
): AnalysisV2ResultValidation {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      reason: "The model response must be a JSON object.",
    };
  }

  if (
    !hasOnlyKeys(raw, [
      "scriptType",
      "verdict",
      "scores",
      "hookDecision",
      "hookAssessment",
      "suggestedHook",
      "riskyParts",
      "suggestedFixes",
      "scenes",
      "mainTakeaway",
    ])
  ) {
    return {
      ok: false,
      reason:
        "The model response contains unsupported fields.",
    };
  }

  if (
    !isEnumMember(
      raw.scriptType,
      ANALYSIS_V2_SCRIPT_TYPES
    )
  ) {
    return {
      ok: false,
      reason: "scriptType is invalid.",
    };
  }

  if (
    !isEnumMember(
      raw.verdict,
      ANALYSIS_V2_VERDICTS
    )
  ) {
    return {
      ok: false,
      reason: "verdict is invalid.",
    };
  }

  if (!isPlainObject(raw.scores)) {
    return {
      ok: false,
      reason: "scores must be an object.",
    };
  }

  if (
    !hasOnlyKeys(raw.scores, [
      "overall",
      "hook",
      "retentionRisk",
    ])
  ) {
    return {
      ok: false,
      reason: "scores contains unsupported fields.",
    };
  }

  if (
    !isFiniteScore(raw.scores.overall) ||
    !isFiniteScore(raw.scores.hook) ||
    !isFiniteScore(raw.scores.retentionRisk)
  ) {
    return {
      ok: false,
      reason:
        "All scores must be finite numbers from 0 to 100.",
    };
  }

  if (
    !isEnumMember(
      raw.hookDecision,
      ANALYSIS_V2_HOOK_DECISIONS
    )
  ) {
    return {
      ok: false,
      reason: "hookDecision is invalid.",
    };
  }

  if (
    !isNonEmptyBoundedString(
      raw.hookAssessment,
      ANALYSIS_V2_LIMITS.maxHookAssessmentCharacters
    )
  ) {
    return {
      ok: false,
      reason: "hookAssessment is missing or too long.",
    };
  }

  const hookDecision =
    raw.hookDecision as AnalysisV2HookDecision;

  const hasSuggestedHook =
    typeof raw.suggestedHook === "string" &&
    raw.suggestedHook.trim().length > 0;

  if (
    (hookDecision === "keep" ||
      hookDecision === "diagnostic") &&
    hasSuggestedHook
  ) {
    return {
      ok: false,
      reason:
        "suggestedHook must be absent for keep and diagnostic decisions.",
    };
  }

  if (
    (hookDecision === "refine" ||
      hookDecision === "rewrite") &&
    !hasSuggestedHook
  ) {
    return {
      ok: false,
      reason:
        "suggestedHook is required for refine and rewrite decisions.",
    };
  }

  if (
    raw.suggestedHook !== undefined &&
    raw.suggestedHook !== null &&
    typeof raw.suggestedHook !== "string"
  ) {
    return {
      ok: false,
      reason:
        "suggestedHook must be a string or null.",
    };
  }

  if (
    hasSuggestedHook &&
    !isNonEmptyBoundedString(
      raw.suggestedHook,
      ANALYSIS_V2_LIMITS.maxSuggestedHookCharacters
    )
  ) {
    return {
      ok: false,
      reason: "suggestedHook is too long.",
    };
  }

  if (
    hasSuggestedHook &&
    suggestedHookIntroducesNumber(
      raw.suggestedHook as string,
      script
    )
  ) {
    return {
      ok: false,
      reason:
        "suggestedHook introduces a number that is not present in the script.",
    };
  }

  if (
    hasSuggestedHook &&
    suggestedHookIntroducesNamedEntity(
      raw.suggestedHook as string,
      script
    )
  ) {
    return {
      ok: false,
      reason:
        "suggestedHook introduces a named entity that is not present in the script.",
    };
  }

  if (
    hasSuggestedHook &&
    suggestedHookIntroducesUnsupportedClaimStrength(
      raw.suggestedHook as string,
      script
    )
  ) {
    return {
      ok: false,
      reason:
        "suggestedHook strengthens a factual claim beyond the submitted script.",
    };
  }

  if (!Array.isArray(raw.riskyParts)) {
    return {
      ok: false,
      reason: "riskyParts must be an array.",
    };
  }

  if (
    raw.riskyParts.length >
    ANALYSIS_V2_LIMITS.maxRiskyParts
  ) {
    return {
      ok: false,
      reason: "The result contains too many risky parts.",
    };
  }

  const riskyParts: AnalysisV2RiskyPart[] = [];

  for (const riskyPart of raw.riskyParts) {
    const validation = validateRiskyPart(
      riskyPart,
      script
    );

    if (!validation.ok) {
      return validation;
    }

    riskyParts.push(validation.value);
  }

  if (!Array.isArray(raw.suggestedFixes)) {
    return {
      ok: false,
      reason: "suggestedFixes must be an array.",
    };
  }

  if (
    raw.suggestedFixes.length >
    ANALYSIS_V2_LIMITS.maxSuggestedFixes
  ) {
    return {
      ok: false,
      reason:
        "The result contains too many suggested fixes.",
    };
  }

  const suggestedFixes: AnalysisV2SuggestedFix[] = [];

  for (const suggestedFix of raw.suggestedFixes) {
    const validation =
      validateSuggestedFix(suggestedFix);

    if (!validation.ok) {
      return validation;
    }

    suggestedFixes.push(validation.value);
  }

  if (!Array.isArray(raw.scenes)) {
    return {
      ok: false,
      reason: "scenes must be an array.",
    };
  }

  if (
    raw.scenes.length === 0 ||
    raw.scenes.length > ANALYSIS_V2_LIMITS.maxScenes
  ) {
    return {
      ok: false,
      reason:
        "The result must contain between 1 and 6 scenes.",
    };
  }

  const scenes: AnalysisV2Scene[] = [];

  for (const scene of raw.scenes) {
    const validation = validateScene(scene, script);

    if (!validation.ok) {
      return validation;
    }

    scenes.push(validation.value);
  }

  if (
    !isNonEmptyBoundedString(
      raw.mainTakeaway,
      ANALYSIS_V2_LIMITS.maxMainTakeawayCharacters
    )
  ) {
    return {
      ok: false,
      reason: "mainTakeaway is missing or too long.",
    };
  }

  const verdict = raw.verdict as AnalysisV2Verdict;
  const overall = raw.scores.overall;
  const retentionRisk = raw.scores.retentionRisk;
  const requiredFixes = suggestedFixes.filter(
    (fix) => !fix.optional
  );
  const requiredHookFixes = suggestedFixes.filter(
    (fix) =>
      fix.target === "hook" && !fix.optional
  );
  const openingWindow =
    extractAnalysisV2OpeningWindow(script);
  const hasHookEvidence =
    suggestedFixes.some(
      (fix) => fix.target === "hook"
    ) ||
    riskyParts.some((part) =>
      riskyPartOverlapsOpening(
        part.excerpt,
        openingWindow,
        script
      )
    );
  const shouldNormalizeHookDecision =
    (hookDecision === "refine" ||
      hookDecision === "rewrite") &&
    !hasHookEvidence;
  const normalizedHookDecision:
    AnalysisV2HookDecision =
      shouldNormalizeHookDecision
        ? "keep"
        : hookDecision;
  const normalizedSuggestedHook =
    !shouldNormalizeHookDecision &&
    hasSuggestedHook
      ? (raw.suggestedHook as string).trim()
      : undefined;

  if (
    normalizedHookDecision === "keep" &&
    requiredHookFixes.length > 0
  ) {
    return {
      ok: false,
      reason:
        "A keep hook decision cannot contain a required hook fix.",
    };
  }

  const hasGenericOpeningFiller =
    hasGenericFirstSentenceFiller(script);
  const firstSentence = extractFirstSentence(script);
  const hasGroundedGenericOpeningRisk =
    riskyParts.some((part) =>
      riskyPartOverlapsOpening(
        part.excerpt,
        firstSentence,
        script
      )
    );

  if (hasGenericOpeningFiller) {
    if (verdict === "strong") {
      return {
        ok: false,
        reason:
          "A script with generic first-sentence filler cannot receive a strong verdict.",
      };
    }

    if (!hasGroundedGenericOpeningRisk) {
      return {
        ok: false,
        reason:
          "Generic first-sentence filler must be identified as a grounded risky part.",
      };
    }

    if (requiredHookFixes.length === 0) {
      return {
        ok: false,
        reason:
          "Generic first-sentence filler requires a non-optional hook fix.",
      };
    }

    if (
      normalizedHookDecision !== "refine" &&
      normalizedHookDecision !== "rewrite"
    ) {
      return {
        ok: false,
        reason:
          "Generic first-sentence filler requires a refine or rewrite hook decision.",
      };
    }
  }

  if (verdict === "strong") {
    if (overall < 70 || retentionRisk > 45) {
      return {
        ok: false,
        reason:
          "A strong verdict is inconsistent with the supplied scores.",
      };
    }

    if (riskyParts.length !== 0) {
      return {
        ok: false,
        reason:
          "A strong result must not contain risky parts.",
      };
    }

    if (
      scenes.some((scene) => scene.status === "risky")
    ) {
      return {
        ok: false,
        reason:
          "A strong result must not contain risky scenes.",
      };
    }

    if (suggestedFixes.length > 1) {
      return {
        ok: false,
        reason:
          "A strong result may contain at most one optional refinement.",
      };
    }

    if (
      suggestedFixes.some((fix) => !fix.optional)
    ) {
      return {
        ok: false,
        reason:
          "Every fix in a strong result must be optional.",
      };
    }

    if (
      overall < 85 &&
      suggestedFixes.length === 0
    ) {
      return {
        ok: false,
        reason:
          "A strong result below 85 must contain one optional refinement.",
      };
    }

    if (
      hookDecision !== "keep" &&
      hookDecision !== "refine"
    ) {
      return {
        ok: false,
        reason:
          "A strong result must use keep or refine.",
      };
    }
  }

  if (verdict === "mixed") {
    if (overall < 46 || overall > 84) {
      return {
        ok: false,
        reason:
          "A mixed verdict is inconsistent with the supplied overall score.",
      };
    }

    if (riskyParts.length === 0) {
      return {
        ok: false,
        reason:
          "A mixed result must contain a grounded risky part.",
      };
    }

    if (requiredFixes.length === 0) {
      return {
        ok: false,
        reason:
          "A mixed result must contain a non-optional suggested fix.",
      };
    }
  }

  if (verdict === "weak") {
    if (overall > 60) {
      return {
        ok: false,
        reason:
          "A weak verdict is inconsistent with a high overall score.",
      };
    }

    if (riskyParts.length === 0) {
      return {
        ok: false,
        reason:
          "A weak result must contain a grounded risky part.",
      };
    }

    if (requiredFixes.length === 0) {
      return {
        ok: false,
        reason:
          "A weak result must contain a non-optional suggested fix.",
      };
    }
  }

  return {
    ok: true,
    value: {
      scriptType:
        raw.scriptType as AnalysisV2ScriptType,
      verdict,
      scores: {
        overall: Math.round(raw.scores.overall),
        hook: Math.round(raw.scores.hook),
        retentionRisk: Math.round(
          raw.scores.retentionRisk
        ),
      },
      hookDecision: normalizedHookDecision,
      hookAssessment: raw.hookAssessment.trim(),
      ...(normalizedSuggestedHook
        ? {
            suggestedHook:
              normalizedSuggestedHook,
          }
        : {}),
      riskyParts,
      suggestedFixes,
      scenes,
      mainTakeaway: raw.mainTakeaway.trim(),
    },
  };
}
