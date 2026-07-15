import {
  ANALYSIS_V2_FIX_TARGETS,
  ANALYSIS_V2_HOOK_DECISIONS,
  ANALYSIS_V2_LIMITS,
  ANALYSIS_V2_SCENE_STATUSES,
  ANALYSIS_V2_SCORE_COMPONENT_KEYS,
  ANALYSIS_V2_SCRIPT_TYPES,
  ANALYSIS_V2_SEVERITIES,
  ANALYSIS_V2_VERDICTS,
  type AnalysisV2FixTarget,
  type AnalysisV2HookDecision,
  type AnalysisV2Locale,
  type AnalysisV2Result,
  type AnalysisV2RiskyPart,
  type AnalysisV2ScoreBreakdown,
  type AnalysisV2Scores,
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

function isScoreComponent(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 25
  );
}

function hasExactlyKeys(
  value: Record<string, unknown>,
  requiredKeys: readonly string[]
): boolean {
  return (
    hasOnlyKeys(value, requiredKeys) &&
    requiredKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(
        value,
        key
      )
    )
  );
}

type ScoreComponentGroupValidation =
  | {
      ok: true;
      value: Record<string, number>;
    }
  | {
      ok: false;
      reason: string;
    };

function validateScoreComponentGroup(
  raw: unknown,
  requiredKeys: readonly string[],
  label: string
): ScoreComponentGroupValidation {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      reason: `${label} score components must be an object.`,
    };
  }

  if (!hasExactlyKeys(raw, requiredKeys)) {
    return {
      ok: false,
      reason: `${label} score components must contain exactly: ${requiredKeys.join(
        ", "
      )}.`,
    };
  }

  const value: Record<string, number> = {};

  for (const key of requiredKeys) {
    if (!isScoreComponent(raw[key])) {
      return {
        ok: false,
        reason: `${label}.${key} must be an integer from 0 to 25.`,
      };
    }

    value[key] = raw[key];
  }

  return {
    ok: true,
    value,
  };
}

function sumScoreComponentGroup(
  values: Record<string, number>,
  keys: readonly string[]
): number {
  return keys.reduce(
    (total, key) => total + values[key],
    0
  );
}

function createScoreBreakdown(
  overall: Record<string, number>,
  hook: Record<string, number>,
  retentionRisk: Record<string, number>
): AnalysisV2ScoreBreakdown {
  return {
    overall: {
      premiseAppeal: overall.premiseAppeal,
      openingPromise: overall.openingPromise,
      progression: overall.progression,
      payoff: overall.payoff,
    },
    hook: {
      immediacy: hook.immediacy,
      specificity: hook.specificity,
      viewerPull: hook.viewerPull,
      deliveryAlignment: hook.deliveryAlignment,
    },
    retentionRisk: {
      openingFriction: retentionRisk.openingFriction,
      progressionRisk: retentionRisk.progressionRisk,
      predictabilityRisk:
        retentionRisk.predictabilityRisk,
      payoffRisk: retentionRisk.payoffRisk,
    },
  };
}

type ScoreBreakdownValidation =
  | {
      ok: true;
      value: AnalysisV2ScoreBreakdown;
    }
  | {
      ok: false;
      reason: string;
    };

function validateScoreBreakdown(
  raw: unknown,
  scores: AnalysisV2Scores
): ScoreBreakdownValidation {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      reason: "scoreBreakdown must be an object.",
    };
  }

  if (
    !hasExactlyKeys(raw, [
      "overall",
      "hook",
      "retentionRisk",
    ])
  ) {
    return {
      ok: false,
      reason:
        "scoreBreakdown must contain exactly overall, hook, and retentionRisk.",
    };
  }

  const overallValidation =
    validateScoreComponentGroup(
      raw.overall,
      ANALYSIS_V2_SCORE_COMPONENT_KEYS.overall,
      "scoreBreakdown.overall"
    );

  if (!overallValidation.ok) {
    return overallValidation;
  }

  const hookValidation =
    validateScoreComponentGroup(
      raw.hook,
      ANALYSIS_V2_SCORE_COMPONENT_KEYS.hook,
      "scoreBreakdown.hook"
    );

  if (!hookValidation.ok) {
    return hookValidation;
  }

  const retentionRiskValidation =
    validateScoreComponentGroup(
      raw.retentionRisk,
      ANALYSIS_V2_SCORE_COMPONENT_KEYS.retentionRisk,
      "scoreBreakdown.retentionRisk"
    );

  if (!retentionRiskValidation.ok) {
    return retentionRiskValidation;
  }

  const totalsMatch =
    sumScoreComponentGroup(
      overallValidation.value,
      ANALYSIS_V2_SCORE_COMPONENT_KEYS.overall
    ) === scores.overall &&
    sumScoreComponentGroup(
      hookValidation.value,
      ANALYSIS_V2_SCORE_COMPONENT_KEYS.hook
    ) === scores.hook &&
    sumScoreComponentGroup(
      retentionRiskValidation.value,
      ANALYSIS_V2_SCORE_COMPONENT_KEYS.retentionRisk
    ) === scores.retentionRisk;

  if (!totalsMatch) {
    return {
      ok: false,
      reason:
        "scoreBreakdown totals must match the public scores.",
    };
  }

  return {
    ok: true,
    value: createScoreBreakdown(
      overallValidation.value,
      hookValidation.value,
      retentionRiskValidation.value
    ),
  };
}

// Includes both the English and Russian exact allowed forms (see the
// GROUNDING and LANGUAGE sections of buildAnalysisV2SystemPrompt) so a
// grounded RU suggestedFix is recognized just as reliably as an EN one —
// checked regardless of the requested locale, which only ever widens
// recognition and cannot weaken this safety net for either language.
const ALLOWED_VERIFIED_FACTUAL_FIXES = [
  {
    normalized:
      "add a verified consequence or implication that explains why this matters",
    canonical:
      "Add a verified consequence or implication that explains why this matters.",
  },
  {
    normalized:
      "add a verified contrast, example, or measurable result that strengthens the payoff",
    canonical:
      "Add a verified contrast, example, or measurable result that strengthens the payoff.",
  },
  {
    normalized:
      "добавьте проверенное следствие или значение, которое объясняет, почему это важно",
    canonical:
      "Добавьте проверенное следствие или значение, которое объясняет, почему это важно.",
  },
  {
    normalized:
      "добавьте проверенный контраст, пример или измеримый результат, который усиливает развязку",
    canonical:
      "Добавьте проверенный контраст, пример или измеримый результат, который усиливает развязку.",
  },
] as const;

function canonicalizeVerifiedFactualSuggestion(
  suggestion: string
): string | null {
  const normalized = suggestion
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "")
    .toLowerCase();

  for (const allowed of ALLOWED_VERIFIED_FACTUAL_FIXES) {
    if (normalized === allowed.normalized) {
      return allowed.canonical;
    }

    if (!normalized.startsWith(allowed.normalized)) {
      continue;
    }

    const suffix = normalized.slice(
      allowed.normalized.length
    );

    const isAppendedCandidateDirection =
      /^(?:\s*[,;:]?\s*|\s*[-—]\s*)(?:such as|for example|including|like)\b/i.test(
        suffix
      ) ||
      // Russian equivalents ("например", "включая", "вроде", "такие как").
      // \b does not work for Cyrillic, so this is plain substring matching.
      /^(?:\s*[,;:]?\s*|\s*[-—]\s*)(?:например|включая|вроде|такие как)/i.test(
        suffix
      );

    if (isAppendedCandidateDirection) {
      return allowed.canonical;
    }
  }

  return null;
}

function hasResolvedOutcomeNarrative(
  script: string
): boolean {
  const hasEstablishedMeaningfulStakes =
    /\b(?:danger|dangerous|risk|risky|stakes|threat|emergency|accident|attack|crash|explosion|fire|trapped|collapsed|injured|wounded|stranded|missing|disappeared|vanished|failed|failure|broke|lost|warning|alarm|pressure|leak|shutdown|evacuated|search|rescue|deadline|loss|cost|debt|bankrupt|lawsuit|ban|test|trial|final)\b/i.test(
      script
    );

  const hasResolvedOutcome =
    /\b(?:survived|survive|made it out alive|escaped alive|escaped|recovered|rescued|found|discovered|captured|caught|arrested|identified|returned|stopped|ended|solved|resolved|confirmed|completed|passed|won|reached|crossed)\b/i.test(
      script
    );

  const openingWindow =
    extractAnalysisV2OpeningWindow(script);

  const openingPromisesExternalAftermath =
    /\b(?:what happened next|aftermath|changed history|changed security|led to|resulted in|the impact|the consequence|why it mattered)\b/i.test(
      openingWindow
    );

  return (
    hasEstablishedMeaningfulStakes &&
    hasResolvedOutcome &&
    !openingPromisesExternalAftermath
  );
}

function isResolvedOutcomeExcerpt(
  excerpt: string
): boolean {
  return /\b(?:survived|survive|made it out alive|escaped alive|escaped|recovered|rescued|found|discovered|captured|caught|arrested|identified|returned|stopped|ended|solved|resolved|confirmed|completed|passed|won|reached|crossed)\b/i.test(
    excerpt
  );
}

function criticizesResolvedOutcomeForMissingExternalMeaning(
  reason: string
): boolean {
  return /\b(?:underwhelming|significance|consequence|broader implication|external implication|why (?:this|it) matters|limiting viewer reward|deeper implication)\b/i.test(
    reason
  );
}

function requestsExternalNarrativeConsequence(
  suggestion: string
): boolean {
  const normalized = suggestion
    .replace(/\s+/g, " ")
    .trim();

  return (
    /\b(?:verified consequence|broader implication|external consequence|historical consequence|policy change|security response|significance)\b/i.test(
      normalized
    ) ||
    /\bwhy\b.{0,120}\bmatters\b/i.test(
      normalized
    ) ||
    /\b(?:contrast|example|implication)\b.{0,120}\b(?:outcome|resolution|ending|result|survival|escape|recovery|capture|discovery|found)\b/i.test(
      normalized
    )
  );
}

function hasUnpunctuatedCompleteCausalExplanation(
  script: string
): boolean {
  const normalized = script
    .replace(/\s+/g, " ")
    .trim();

  const hasSentenceBoundary =
    /[.!?]/.test(normalized);

  const hasCausalLink =
    /\b(?:because|since|due to|causes?|caused by|when|as a result)\b/i.test(
      normalized
    );

  const hasPhysicalOrObservableEffect =
    /\b(?:releases?|raises?|increases?|prepares?|triggers?|affects?|makes?|causes?|shakes?|contracts?)\b/i.test(
      normalized
    );

  const hasResolution =
    /\b(?:once|after|when)\b.{0,160}\b(?:falls?|drops?|fades?|stops?|ends?|returns?|recovers?|settles?)\b/i.test(
      normalized
    );

  return (
    !hasSentenceBoundary &&
    hasCausalLink &&
    hasPhysicalOrObservableEffect &&
    hasResolution
  );
}

function criticizesCompleteCausalExplanationForMissingDepth(
  feedback: string
): boolean {
  const normalized = feedback
    .replace(/\s+/g, " ")
    .trim();

  const explicitlyRejectsNeedForMoreDepth =
    /\b(?:does not|doesn't|do not|don't|did not|didn't)\s+(?:need|require|lack)\b.{0,100}\b(?:depth|deeper mechanism|more detail|additional detail|additional examples?|more examples?|additional implications?)\b/i.test(
      normalized
    ) ||
    /\bno need (?:to|for)\b.{0,100}\b(?:depth|deeper mechanism|more detail|additional detail|additional examples?|more examples?|additional implications?)\b/i.test(
      normalized
    ) ||
    /\bwithout (?:needing|requiring)\b.{0,100}\b(?:depth|a deeper mechanism|more detail|additional detail|additional examples?|more examples?|additional implications?)\b/i.test(
      normalized
    );

  if (explicitlyRejectsNeedForMoreDepth) {
    return false;
  }

  return /\b(?:very brief|too brief|lacks depth|lacks deeper mechanism|deeper mechanism|lacks.*examples?|needs.*examples?|missing.*mechanism|shallow|incomplete explanation|more detail|additional detail|additional implications?)\b/i.test(
    normalized
  );
}

function requestsUnnecessaryCausalExpansion(
  feedback: string
): boolean {
  const normalized = feedback
    .replace(/\s+/g, " ")
    .trim();

  const explicitlyRejectsCausalExpansion =
    /\b(?:does not|doesn't|do not|don't|did not|didn't)\s+(?:need|require|request)\b.{0,120}\b(?:explanations?|mechanisms?|examples?|details?|implications?|consequences?)\b/i.test(
      normalized
    ) ||
    /\bno need (?:to|for)\b.{0,120}\b(?:expand|deepen|add|include|provide|explanations?|mechanisms?|examples?|details?|implications?|consequences?)\b/i.test(
      normalized
    ) ||
    /\bwithout (?:needing|requiring|requesting|adding|including|providing|expanding|deepening)\b.{0,120}\b(?:explanations?|mechanisms?|examples?|details?|implications?|consequences?)\b/i.test(
      normalized
    );

  if (explicitlyRejectsCausalExpansion) {
    return false;
  }

  const directlyExpandsExistingMaterial =
    /\b(?:expand(?:s|ed|ing)?|deepen(?:s|ed|ing)?)\b.{0,120}\b(?:explanations?|mechanisms?|examples?|details?|implications?|consequences?)\b/i.test(
      normalized
    );

  const addsMoreMaterial =
    /\b(?:add(?:ed|ing)?|include(?:d|ing)?|provide(?:d|ing)?)\b.{0,80}\b(?:(?:a|an|the|some)\s+)?(?:more|additional|further|deeper|clearer|detailed|extra|another|new|specific|concrete)\b.{0,60}\b(?:explanations?|mechanisms?|examples?|details?|implications?|consequences?)\b/i.test(
      normalized
    );

  const explicitlyRequestsMoreMaterial =
    /\b(?:needs?|requires?|requests?|should|could|would)\b.{0,100}\b(?:clearer|deeper|more detailed|additional|further|extra|another|new|specific|concrete)\b.{0,60}\b(?:explanations?|mechanisms?|examples?|details?|implications?|consequences?)\b/i.test(
      normalized
    ) ||
    /\b(?:clearer|deeper|more detailed|additional|further|extra|another|new|specific|concrete)\b.{0,60}\b(?:explanations?|mechanisms?|examples?|details?|implications?|consequences?)\b.{0,50}\b(?:is|are)\s+(?:needed|required|missing)\b/i.test(
      normalized
    );

  return (
    directlyExpandsExistingMaterial ||
    addsMoreMaterial ||
    explicitlyRequestsMoreMaterial
  );
}

function deriveOverallScoreForCausalNormalization(
  raw: Record<string, unknown>
): number | null {
  if (
    isPlainObject(raw.scores) &&
    typeof raw.scores.overall === "number" &&
    Number.isFinite(raw.scores.overall) &&
    raw.scores.overall >= 0 &&
    raw.scores.overall <= 100
  ) {
    return Math.round(raw.scores.overall);
  }

  if (!isPlainObject(raw.scoreComponents)) {
    return null;
  }

  const overallValidation =
    validateScoreComponentGroup(
      raw.scoreComponents.overall,
      ANALYSIS_V2_SCORE_COMPONENT_KEYS.overall,
      "scoreComponents.overall"
    );

  if (!overallValidation.ok) {
    return null;
  }

  return sumScoreComponentGroup(
    overallValidation.value,
    ANALYSIS_V2_SCORE_COMPONENT_KEYS.overall
  );
}

function deriveRetentionRiskForCausalNormalization(
  raw: Record<string, unknown>
): number | null {
  if (
    isPlainObject(raw.scores) &&
    typeof raw.scores.retentionRisk === "number" &&
    Number.isFinite(raw.scores.retentionRisk) &&
    raw.scores.retentionRisk >= 0 &&
    raw.scores.retentionRisk <= 100
  ) {
    return Math.round(
      raw.scores.retentionRisk
    );
  }

  if (!isPlainObject(raw.scoreComponents)) {
    return null;
  }

  const retentionValidation =
    validateScoreComponentGroup(
      raw.scoreComponents.retentionRisk,
      ANALYSIS_V2_SCORE_COMPONENT_KEYS.retentionRisk,
      "scoreComponents.retentionRisk"
    );

  if (!retentionValidation.ok) {
    return null;
  }

  return sumScoreComponentGroup(
    retentionValidation.value,
    ANALYSIS_V2_SCORE_COMPONENT_KEYS.retentionRisk
  );
}

const CAUSAL_NORMALIZATION_FOUR_TIE: Record<AnalysisV2Locale, string> = {
  en: "The premise, opening promise, progression, and payoff are all solid but only moderately strong, which limits the overall score.",
  ru: "Предпосылка, обещание в начале, развитие и развязка — всё крепкое, но лишь умеренно сильное, что ограничивает общую оценку.",
};

const CAUSAL_NORMALIZATION_MULTI_TIE: Record<
  AnalysisV2Locale,
  (joinedLabels: string) => string
> = {
  en: (joinedLabels) =>
    `The lowest-scoring areas are ${joinedLabels}; their moderate strength limits the overall score.`,
  ru: (joinedLabels) =>
    `Самые слабые области — ${joinedLabels}; их умеренная сила ограничивает общую оценку.`,
};

const CAUSAL_NORMALIZATION_SINGLE: Record<
  AnalysisV2Locale,
  Record<OverallBreakdownKey, string>
> = {
  en: {
    premiseAppeal:
      "The main limitation is moderate audience pull from the premise, which keeps the overall score below 80.",
    openingPromise:
      "The main limitation is the opening promise, which is clear but only moderately strong.",
    progression:
      "The main limitation is progression, which is complete but only moderately engaging.",
    payoff:
      "The main limitation is the payoff, which resolves the explanation but offers only a moderate viewer reward.",
  },
  ru: {
    premiseAppeal:
      "Основное ограничение — умеренный охват аудитории предпосылкой, что удерживает общую оценку ниже 80.",
    openingPromise:
      "Основное ограничение — обещание в начале, которое понятно, но лишь умеренно сильное.",
    progression:
      "Основное ограничение — развитие, которое завершено, но лишь умеренно увлекательно.",
    payoff:
      "Основное ограничение — развязка, которая завершает объяснение, но даёт лишь умеренную награду зрителю.",
  },
};

function createCausalNormalizationMainTakeaway(
  raw: Record<string, unknown>,
  overall: number,
  baseTakeaway: string,
  locale: AnalysisV2Locale = "en"
): string {
  if (
    overall >= 80 ||
    !isPlainObject(raw.scoreComponents)
  ) {
    return baseTakeaway;
  }

  const overallValidation =
    validateScoreComponentGroup(
      raw.scoreComponents.overall,
      ANALYSIS_V2_SCORE_COMPONENT_KEYS.overall,
      "scoreComponents.overall"
    );

  if (!overallValidation.ok) {
    return baseTakeaway;
  }

  const entries = Object.entries(
    overallValidation.value
  ) as [OverallBreakdownKey, number][];

  const lowestScore = Math.min(
    ...entries.map(([, score]) => score)
  );

  const lowestKeys = entries
    .filter(([, score]) => score === lowestScore)
    .map(([key]) => key);

  // Reuses the same component/limitation term tables as
  // mainTakeawayExplainsLowestOverallComponent — see the note there about
  // why \b does not work for Cyrillic.
  const componentTerms =
    locale === "ru"
      ? OVERALL_COMPONENT_TAKEAWAY_TERMS_RU
      : OVERALL_COMPONENT_TAKEAWAY_TERMS;
  const limitationTerms =
    locale === "ru"
      ? OVERALL_LIMITATION_TERMS_RU
      : OVERALL_LIMITATION_TERMS;

  const alreadyExplainsLowestComponent =
    limitationTerms.some((pattern) => pattern.test(baseTakeaway)) &&
    lowestKeys.some((key) =>
      componentTerms[key]?.some((pattern) =>
        pattern.test(baseTakeaway)
      )
    );

  if (alreadyExplainsLowestComponent) {
    return baseTakeaway;
  }

  const labelTable =
    locale === "ru"
      ? OVERALL_COMPONENT_REPAIR_LABELS_RU
      : OVERALL_COMPONENT_REPAIR_LABELS;

  if (lowestKeys.length === 4) {
    return `${baseTakeaway} ${CAUSAL_NORMALIZATION_FOUR_TIE[locale]}`;
  }

  if (lowestKeys.length > 1) {
    const lowestLabels = lowestKeys.map(
      (key) => labelTable[key] ?? key
    );

    const finalLabel =
      lowestLabels.pop() ?? "";

    const joinedLabels =
      lowestLabels.length === 0
        ? finalLabel
        : locale === "ru"
          ? `${lowestLabels.join(", ")} и ${finalLabel}`
          : `${lowestLabels.join(", ")} and ${finalLabel}`;

    return `${baseTakeaway} ${CAUSAL_NORMALIZATION_MULTI_TIE[locale](joinedLabels)}`;
  }

  const lowestKey = lowestKeys[0];

  if (!lowestKey) {
    return baseTakeaway;
  }

  return `${baseTakeaway} ${CAUSAL_NORMALIZATION_SINGLE[locale][lowestKey]}`;
}

const CAUSAL_NORMALIZATION_SCENE_LABEL: Record<AnalysisV2Locale, string> = {
  en: "Cause, observable effect, and resolution",
  ru: "Причина, наблюдаемый эффект и развязка",
};

const CAUSAL_NORMALIZATION_FILLER_HOOK_ASSESSMENT: Record<
  AnalysisV2Locale,
  string
> = {
  en: "The opening filler delays the concrete premise, while the cause, observable effect, and resolution remain complete.",
  ru: "Вступительный наполнитель задерживает конкретную суть, при этом причина, наблюдаемый эффект и развязка остаются полными.",
};

const CAUSAL_NORMALIZATION_FILLER_RISKY_REASON: Record<
  AnalysisV2Locale,
  string
> = {
  en: "The opening filler delays the concrete premise and reduces hook immediacy.",
  ru: "Вступительный наполнитель задерживает конкретную суть и снижает непосредственность хука.",
};

const CAUSAL_NORMALIZATION_FILLER_FIX: Record<
  AnalysisV2Locale,
  (fillerExcerpt: string) => string
> = {
  en: (fillerExcerpt) =>
    `Remove the opening filler '${fillerExcerpt}' and start directly with the concrete premise.`,
  ru: (fillerExcerpt) =>
    `Уберите вступительный наполнитель «${fillerExcerpt}» и начните сразу с конкретной сути.`,
};

const CAUSAL_NORMALIZATION_FILLER_BASE_TAKEAWAY: Record<
  AnalysisV2Locale,
  string
> = {
  en: "The causal explanation is complete; only the opening filler limits immediacy.",
  ru: "Причинно-следственное объяснение полное; только вступительный наполнитель ограничивает непосредственность.",
};

const CAUSAL_NORMALIZATION_STRONG_HOOK_ASSESSMENT: Record<
  AnalysisV2Locale,
  string
> = {
  en: "The opening immediately presents the physical reaction, and the script completes the causal chain from trigger to effect and resolution.",
  ru: "Начало сразу показывает физическую реакцию, а сценарий завершает причинно-следственную цепочку от триггера к эффекту и развязке.",
};

const CAUSAL_NORMALIZATION_STRONG_BASE_TAKEAWAY: Record<
  AnalysisV2Locale,
  string
> = {
  en: "The script provides a complete causal explanation from the trigger through the observable effect to the resolution.",
  ru: "Сценарий даёт полное причинно-следственное объяснение от триггера через наблюдаемый эффект до развязки.",
};

const CAUSAL_NORMALIZATION_MIXED_HOOK_ASSESSMENT: Record<
  AnalysisV2Locale,
  string
> = {
  en: "The opening immediately presents the physical reaction and establishes the explanation clearly.",
  ru: "Начало сразу показывает физическую реакцию и чётко формулирует объяснение.",
};

const CAUSAL_NORMALIZATION_MIXED_RISKY_REASON: Record<
  AnalysisV2Locale,
  string
> = {
  en: "The lack of sentence boundaries makes the otherwise complete causal explanation harder to scan and follow.",
  ru: "Отсутствие границ предложений усложняет восприятие в остальном полного причинно-следственного объяснения.",
};

const CAUSAL_NORMALIZATION_MIXED_FIX: Record<AnalysisV2Locale, string> = {
  en: "Add sentence boundaries between the trigger, physical effect, and resolution without expanding the explanation.",
  ru: "Добавьте границы предложений между триггером, физическим эффектом и развязкой, не расширяя объяснение.",
};

const CAUSAL_NORMALIZATION_MIXED_BASE_TAKEAWAY: Record<
  AnalysisV2Locale,
  string
> = {
  en: "The causal explanation is complete; only the missing sentence boundaries reduce readability.",
  ru: "Причинно-следственное объяснение полное; только отсутствие границ предложений снижает читаемость.",
};

export function normalizeAnalysisV2CompleteCausalExplanationModelResult(
  raw: unknown,
  script: string,
  locale: AnalysisV2Locale = "en"
): unknown | null {
  if (
    !isPlainObject(raw) ||
    raw.scriptType !== "explanation" ||
    !hasUnpunctuatedCompleteCausalExplanation(script) ||
    !Array.isArray(raw.riskyParts) ||
    !Array.isArray(raw.suggestedFixes) ||
    !Array.isArray(raw.scenes) ||
    raw.scenes.length === 0
  ) {
    return null;
  }

  const overall =
    deriveOverallScoreForCausalNormalization(
      raw
    );
  const retentionRisk =
    deriveRetentionRiskForCausalNormalization(
      raw
    );

  if (
    overall === null ||
    retentionRisk === null
  ) {
    return null;
  }

  const feedbackTexts: string[] = [];

  if (typeof raw.hookAssessment === "string") {
    feedbackTexts.push(raw.hookAssessment);
  }

  if (typeof raw.mainTakeaway === "string") {
    feedbackTexts.push(raw.mainTakeaway);
  }

  for (const part of raw.riskyParts) {
    if (
      isPlainObject(part) &&
      typeof part.reason === "string"
    ) {
      feedbackTexts.push(part.reason);
    }
  }

  for (const fix of raw.suggestedFixes) {
    if (
      isPlainObject(fix) &&
      typeof fix.suggestion === "string"
    ) {
      feedbackTexts.push(fix.suggestion);
    }
  }

  for (const scene of raw.scenes) {
    if (
      isPlainObject(scene) &&
      typeof scene.label === "string"
    ) {
      feedbackTexts.push(scene.label);
    }
  }

  const containsInvalidCausalCritique =
    feedbackTexts.some(
      (feedback) =>
        criticizesCompleteCausalExplanationForMissingDepth(
          feedback
        ) ||
        requestsUnnecessaryCausalExpansion(
          feedback
        )
    );

  const containsStrongFeedbackConflict =
    raw.verdict === "strong" &&
    (
      raw.riskyParts.length > 0 ||
      raw.suggestedFixes.some(
        (fix) =>
          isPlainObject(fix) &&
          fix.optional === false
      ) ||
      raw.scenes.some(
        (scene) =>
          isPlainObject(scene) &&
          scene.status === "risky"
      )
    );

  const fillerMatch =
    /^\s*(so basically)\b/i.exec(script);

  if (
    fillerMatch === null &&
    !containsInvalidCausalCritique
  ) {
    return null;
  }

  if (
    fillerMatch !== null &&
    !containsInvalidCausalCritique &&
    !containsStrongFeedbackConflict
  ) {
    return null;
  }

  const neutralizedScenes = raw.scenes.map(
    (scene) => {
      if (
        !isPlainObject(scene) ||
        typeof scene.excerpt !== "string" ||
        typeof scene.label !== "string" ||
        typeof scene.status !== "string"
      ) {
        return scene;
      }

      const labelContainsInvalidCritique =
        criticizesCompleteCausalExplanationForMissingDepth(
          scene.label
        ) ||
        requestsUnnecessaryCausalExpansion(
          scene.label
        );

      return {
        ...scene,
        label: labelContainsInvalidCritique
          ? CAUSAL_NORMALIZATION_SCENE_LABEL[locale]
          : scene.label,
      };
    }
  );

  if (fillerMatch !== null) {
    if (
      overall > 84 ||
      typeof raw.suggestedHook !== "string" ||
      raw.suggestedHook.trim().length === 0
    ) {
      return null;
    }

    const fillerExcerpt = fillerMatch[1];

    return {
      ...raw,
      verdict:
        overall <= 45 ? "weak" : "mixed",
      hookDecision: "refine",
      hookAssessment:
        CAUSAL_NORMALIZATION_FILLER_HOOK_ASSESSMENT[locale],
      suggestedHook: raw.suggestedHook.trim(),
      riskyParts: [
        {
          excerpt: fillerExcerpt,
          reason:
            CAUSAL_NORMALIZATION_FILLER_RISKY_REASON[locale],
          severity: "medium",
        },
      ],
      suggestedFixes: [
        {
          target: "hook",
          suggestion:
            CAUSAL_NORMALIZATION_FILLER_FIX[locale](fillerExcerpt),
          optional: false,
        },
      ],
      scenes: neutralizedScenes.map(
        (scene) =>
          isPlainObject(scene)
            ? {
                ...scene,
                status:
                  scene.status === "risky"
                    ? "average"
                    : scene.status,
              }
            : scene
      ),
      mainTakeaway:
        createCausalNormalizationMainTakeaway(
          raw,
          overall,
          CAUSAL_NORMALIZATION_FILLER_BASE_TAKEAWAY[locale],
          locale
        ),
    };
  }

  const canUseStrongResult =
    overall >= 70 &&
    retentionRisk <= 45;

  if (canUseStrongResult) {
    return {
      ...raw,
      verdict: "strong",
      hookDecision: "keep",
      hookAssessment:
        CAUSAL_NORMALIZATION_STRONG_HOOK_ASSESSMENT[locale],
      suggestedHook: null,
      riskyParts: [],
      suggestedFixes: [],
      scenes: neutralizedScenes.map(
        (scene) =>
          isPlainObject(scene)
            ? {
                ...scene,
                status: "strong",
              }
            : scene
      ),
      mainTakeaway:
        createCausalNormalizationMainTakeaway(
          raw,
          overall,
          CAUSAL_NORMALIZATION_STRONG_BASE_TAKEAWAY[locale],
          locale
        ),
    };
  }

  if (
    overall < 46 ||
    overall > 84
  ) {
    return null;
  }

  return {
    ...raw,
    verdict: "mixed",
    hookDecision: "keep",
    hookAssessment:
      CAUSAL_NORMALIZATION_MIXED_HOOK_ASSESSMENT[locale],
    suggestedHook: null,
    riskyParts: [
      {
        excerpt: script,
        reason:
          CAUSAL_NORMALIZATION_MIXED_RISKY_REASON[locale],
        severity: "low",
      },
    ],
    suggestedFixes: [
      {
        target: "clarity",
        suggestion:
          CAUSAL_NORMALIZATION_MIXED_FIX[locale],
        optional: false,
      },
    ],
    scenes: neutralizedScenes.map(
      (scene) =>
        isPlainObject(scene)
          ? {
              ...scene,
              status: "average",
            }
          : scene
    ),
    mainTakeaway:
      createCausalNormalizationMainTakeaway(
        raw,
        overall,
        CAUSAL_NORMALIZATION_MIXED_BASE_TAKEAWAY[locale],
        locale
      ),
  };
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

    const followingText = value.slice(
      index + token.length
    );

    const isGenericAttributionSource =
      /^(?:scientists?|researchers?|experts?|doctors?|engineers?|studies|research)$/i.test(
        token
      );

    const isSentenceStartNamedAttribution =
      isSentenceStart &&
      /^[A-Z][a-z]/.test(token) &&
      !isGenericAttributionSource &&
      /^\s+(?:says?|said|claims?|claimed|reveals?|revealed|explains?|explained|warns?|warned|reports?|reported|confirms?|confirmed|proves?|proved)\b/i.test(
        followingText
      );

    if (
      isAcronym ||
      hasInternalCapital ||
      isMidSentenceCapitalized ||
      isSentenceStartNamedAttribution
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

function hasConcreteAnchorForGenericAdvice(
  script: string
): boolean {
  const cleaned = normalizeWhitespace(script);

  if (/\d/.test(cleaned)) {
    return true;
  }

  const hasMechanismOrCausalRelationship =
    /\b(?:because|causes?|caused by|leads? to|results? in|works? by|happens? when|which means|so that)\b/i.test(
      cleaned
    );

  if (hasMechanismOrCausalRelationship) {
    return true;
  }

  const hasObservableResult =
    /\b(?:increases?|decreases?|reduces?|improves?|worsens?|doubles?|halves?|saves?|costs?|earns?|loses?|gains?)\b/i.test(
      cleaned
    );

  if (hasObservableResult) {
    return true;
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) =>
      sentence
        .replace(/^[\"'“”‘’(]*[A-Z][a-z]+\b/, "")
        .trim()
    );

  return sentences.some((sentence) =>
    /\b[A-Z][a-z]{2,}\b/.test(sentence)
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

function looksLikeComparisonInsteadOfEscalation(
  script: string
): boolean {
  const cleaned = normalizeWhitespace(script);

  const hasComparisonSetup =
    /\b(?:tested|compared|ranked|measured)\b/i.test(
      cleaned
    ) &&
    /\b(?:side by side|against each other|which .*?(?:wins?|lasts? longest|is fastest|is highest|is lowest))\b/i.test(
      cleaned
    );

  const hasComparisonPayoff =
    /\b(?:clear winner|the winner|won|ranked first|lasted longest|fastest|highest|lowest|best|worst)\b/i.test(
      cleaned
    );

  return hasComparisonSetup && hasComparisonPayoff;
}

function looksLikeParallelAdviceInsteadOfEscalation(
  script: string
): boolean {
  const cleaned = normalizeWhitespace(script);

  const introducesAdviceList =
    /\b(?:habits?|tips?|steps?|ways?|methods?|rules?|practices?)\b/i.test(
      cleaned
    );

  const containsInstructionalActions =
    /\b(?:put|place|write|work|start|stop|use|avoid|keep|try|track|save|move|remove|focus|exercise|read|invest)\b/i.test(
      cleaned
    );

  const hasExplicitEscalation =
    /\b(?:progressively|increasingly|more extreme|even worse|even better|more dangerous|more difficult|more intense|higher stakes|largest|smallest|deadliest|most extreme)\b/i.test(
      cleaned
    );

  return (
    introducesAdviceList &&
    containsInstructionalActions &&
    !hasExplicitEscalation
  );
}

function hasUnrevealedSpecificOpeningPromise(
  script: string
): boolean {
  const cleaned = normalizeWhitespace(script);
  const firstSentence =
    extractFirstSentence(cleaned).toLowerCase();
  const rest = cleaned
    .slice(firstSentence.length)
    .toLowerCase();

  const promisedThingPattern =
    "(?:setting|cause|reason|mechanism|factor|detail|step|signal|method|rule|trigger|flaw|mistake|variable|ingredient|decision)";

  const promisesSpecificHiddenThing = new RegExp(
    `\\b(?:one|a|the)\\s+(?:hidden|secret|specific|exact)\\s+${promisedThingPattern}\\b`,
    "i"
  ).test(firstSentence);

  if (!promisesSpecificHiddenThing) {
    return false;
  }

  const hasVagueNonReveal = [
    /\b(?:once|when|after)\s+you\s+understand\s+(?:it|this|that)\b/i,
    /\b(?:it|this|that)\s+(?:finally\s+)?makes\s+(?:more\s+)?sense\b/i,
    /\b(?:it|this|that)\s+(?:runs|works|happens|moves|changes|spreads|fails)\s+(?:quietly|silently|in the background|without anyone noticing)\b/i,
    /\b(?:most people|almost nobody|no one)\s+(?:never|do not|don't|doesn't)\s+(?:notice|see|question|realize|understand|find|name|identify)(?:\s+(?:it|this|that))?\b/i,
    new RegExp(
      `\\b(?:the|that|this)\\s+(?:hidden|secret\\s+)?${promisedThingPattern}\\s+(?:is|was)?\\s*(?:never|not)\\s+(?:named|revealed|identified|explained)\\b`,
      "i"
    ),
  ].some((pattern) => pattern.test(rest));

  const namesConcretePromisedThing = [
    new RegExp(
      `\\b(?:the|that|this|hidden|secret)\\s+${promisedThingPattern}\\s+(?:is|was|comes from|comes down to|turns out to be|is called|was called|is known as|is named)\\s+(?!something\\b|one\\s+thing\\b|it\\b|this\\b|that\\b)[a-z0-9][a-z0-9'’-]*(?:\\s+[a-z0-9][a-z0-9'’-]*){0,7}\\b`,
      "i"
    ),
    /\b(?:the answer|the explanation)\s+(?:is|was|comes down to)\s+(?!something\b|one\s+thing\b|it\b|this\b|that\b)[a-z0-9][a-z0-9'’-]*(?:\s+[a-z0-9][a-z0-9'’-]*){0,7}\b/i,
    /\b(?:it|this|that)\s+(?:is|was|turns out to be)\s+(?:called|known as|named)\s+(?!something\b|one\s+thing\b)[a-z0-9][a-z0-9'’-]*(?:\s+[a-z0-9][a-z0-9'’-]*){0,7}\b/i,
  ].some((pattern) => pattern.test(rest));

  return hasVagueNonReveal && !namesConcretePromisedThing;
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

type OverallBreakdownKey =
  keyof AnalysisV2ScoreBreakdown["overall"];

const OVERALL_COMPONENT_TAKEAWAY_TERMS: Record<
  OverallBreakdownKey,
  readonly RegExp[]
> = {
  premiseAppeal: [
    /\bpremise\b/i,
    /\baudience pull\b/i,
    /\bviewer reward\b/i,
    /\bangle\b/i,
    /\bidea\b/i,
    /\btopic\b/i,
    /\bstakes?\b/i,
    /\brelevance\b/i,
    /\binterest\b/i,
  ],
  openingPromise: [
    /\bopening promise\b/i,
    /\bpromise\b/i,
    /\bhook\b/i,
    /\bopening\b/i,
    /\bimmediacy\b/i,
  ],
  progression: [
    /\bprogression\b/i,
    /\bstructure\b/i,
    /\bmiddle\b/i,
    /\bmomentum\b/i,
    /\bdevelopment\b/i,
    /\bsequence\b/i,
    /\brepetition\b/i,
    /\bpacing\b/i,
    /\bsentence boundaries\b/i,
    /\breadability\b/i,
  ],
  payoff: [
    /\bpayoff\b/i,
    /\bending\b/i,
    /\bconclusion\b/i,
    /\bresolution\b/i,
    /\breward\b/i,
  ],
};

const OVERALL_LIMITATION_TERMS = [
  /\blimit(?:s|ed|ation|ations|ing)?\b/i,
  /\bweak(?:er|ness|nesses)?\b/i,
  /\blow(?:er)?\b/i,
  /\bmodest\b/i,
  /\bthin\b/i,
  /\bflat\b/i,
  /\bpredictable\b/i,
  /\bgeneric\b/i,
  /\bunclear\b/i,
  /\bunderdeveloped\b/i,
  /\binsufficient\b/i,
  /\bmissing\b/i,
  /\black(?:s|ing)?\b/i,
  /\bneeds?\b/i,
  /\bonly\b/i,
  /\bholds? back\b/i,
  /\bcaps?\b/i,
  /\bcosts?\b/i,
  /\breduces?\b/i,
  /\bdoes not\b/i,
  /\bdoesn't\b/i,
  /\bfails? to\b/i,
  /\bnot enough\b/i,
] as const;

// Russian equivalents of the two term sets above. JS regex `\b` does not
// work for Cyrillic (word-boundary detection relies on the ASCII \w class,
// which excludes Cyrillic letters), so these intentionally use plain
// substring matching on word stems instead of \b-anchored patterns.
const OVERALL_COMPONENT_TAKEAWAY_TERMS_RU: Record<
  OverallBreakdownKey,
  readonly RegExp[]
> = {
  premiseAppeal: [
    /предпосылк/i,
    /охват[а-я]* аудитори/i,
    /ценност[а-я]* для зрител/i,
    /ракурс/i,
    /иде[юяи]/i,
    /тем[аеы]/i,
    /ставк[иа]/i,
    /актуальност/i,
    /интерес/i,
  ],
  openingPromise: [
    /обещани/i,
    /хук/i,
    /начал[оае]/i,
    /открывающ/i,
    /непосредственност/i,
  ],
  progression: [
    /развити/i,
    /структур/i,
    /середин/i,
    /динамик/i,
    /последовательност/i,
    /повтор/i,
    /темп/i,
    /границ[а-я]* предложени/i,
    /читаемост/i,
  ],
  payoff: [
    /развязк/i,
    /концовк/i,
    /заключени/i,
    /разрешени/i,
    /награда/i,
    /вознаграждени/i,
  ],
};

const OVERALL_LIMITATION_TERMS_RU = [
  /ограничива/i,
  /слаб/i,
  /низк/i,
  /умеренн/i,
  /скромн/i,
  /предсказуем/i,
  /обобщенн/i,
  /неясн/i,
  /недостаточно развит/i,
  /недостаточн/i,
  /отсутств/i,
  /нужн/i,
  /только/i,
  /сдержива/i,
  /снижа/i,
  /не хватает/i,
  /не даёт/i,
  /не дает/i,
  /не позволяет/i,
] as const;

function getLowestOverallComponentKeys(
  breakdown: AnalysisV2ScoreBreakdown
): OverallBreakdownKey[] {
  const entries = Object.entries(
    breakdown.overall
  ) as [OverallBreakdownKey, number][];

  const lowestScore = Math.min(
    ...entries.map(([, score]) => score)
  );

  return entries
    .filter(([, score]) => score === lowestScore)
    .map(([key]) => key);
}

const OVERALL_COMPONENT_REPAIR_LABELS: Record<
  OverallBreakdownKey,
  string
> = {
  premiseAppeal: "premise appeal",
  openingPromise: "opening promise",
  progression: "progression",
  payoff: "payoff",
};

const OVERALL_COMPONENT_REPAIR_LABELS_RU: Record<
  OverallBreakdownKey,
  string
> = {
  premiseAppeal: "привлекательность идеи",
  openingPromise: "обещание в начале",
  progression: "развитие сюжета",
  payoff: "развязка",
};

const OVERALL_COMPONENT_REPAIR_LIMITATIONS: Record<
  OverallBreakdownKey,
  string
> = {
  premiseAppeal:
    "the idea has limited audience pull or viewer reward",
  openingPromise:
    "the opening promise is not as compelling or specific as it could be",
  progression:
    "the middle progression is not developed strongly enough",
  payoff:
    "the ending payoff does not deliver a strong enough viewer reward",
};

const OVERALL_COMPONENT_REPAIR_LIMITATIONS_RU: Record<
  OverallBreakdownKey,
  string
> = {
  premiseAppeal:
    "идея слабо привлекает аудиторию и не даёт зрителю достаточной ценности",
  openingPromise:
    "обещание в начале недостаточно убедительное или конкретное",
  progression:
    "развитие середины недостаточно проработано",
  payoff:
    "развязка не даёт зрителю достаточно сильной награды",
};

function formatOverallComponentList(
  keys: OverallBreakdownKey[],
  locale: AnalysisV2Locale = "en"
): string {
  const labelTable =
    locale === "ru"
      ? OVERALL_COMPONENT_REPAIR_LABELS_RU
      : OVERALL_COMPONENT_REPAIR_LABELS;

  const labels = keys.map((key) => labelTable[key]);

  if (labels.length <= 1) {
    return (
      labels[0] ??
      (locale === "ru" ? "общее исполнение" : "overall execution")
    );
  }

  if (labels.length === 2) {
    return locale === "ru"
      ? `${labels[0]} и ${labels[1]}`
      : `${labels[0]} and ${labels[1]}`;
  }

  if (locale === "ru") {
    return `${labels.slice(0, -1).join(", ")} и ${
      labels[labels.length - 1]
    }`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${
    labels[labels.length - 1]
  }`;
}

export function repairAnalysisV2MainTakeawayForScoreBreakdown(
  raw: unknown,
  locale: AnalysisV2Locale = "en"
): unknown | null {
  if (
    !isPlainObject(raw) ||
    typeof raw.mainTakeaway !== "string"
  ) {
    return null;
  }

  let breakdown: AnalysisV2ScoreBreakdown;

  if (
    Object.prototype.hasOwnProperty.call(
      raw,
      "scoreComponents"
    )
  ) {
    if (
      !isPlainObject(raw.scoreComponents) ||
      !hasExactlyKeys(raw.scoreComponents, [
        "overall",
        "hook",
        "retentionRisk",
      ])
    ) {
      return null;
    }

    const overallValidation =
      validateScoreComponentGroup(
        raw.scoreComponents.overall,
        ANALYSIS_V2_SCORE_COMPONENT_KEYS.overall,
        "scoreComponents.overall"
      );
    const hookValidation =
      validateScoreComponentGroup(
        raw.scoreComponents.hook,
        ANALYSIS_V2_SCORE_COMPONENT_KEYS.hook,
        "scoreComponents.hook"
      );
    const retentionRiskValidation =
      validateScoreComponentGroup(
        raw.scoreComponents.retentionRisk,
        ANALYSIS_V2_SCORE_COMPONENT_KEYS.retentionRisk,
        "scoreComponents.retentionRisk"
      );

    if (
      !overallValidation.ok ||
      !hookValidation.ok ||
      !retentionRiskValidation.ok
    ) {
      return null;
    }

    breakdown = createScoreBreakdown(
      overallValidation.value,
      hookValidation.value,
      retentionRiskValidation.value
    );
  } else {
    if (
      !isPlainObject(raw.scores) ||
      !isPlainObject(raw.scoreBreakdown)
    ) {
      return null;
    }

    if (
      !hasOnlyKeys(raw.scores, [
        "overall",
        "hook",
        "retentionRisk",
      ]) ||
      !isFiniteScore(raw.scores.overall) ||
      !isFiniteScore(raw.scores.hook) ||
      !isFiniteScore(raw.scores.retentionRisk)
    ) {
      return null;
    }

    const normalizedScores: AnalysisV2Scores = {
      overall: Math.round(raw.scores.overall),
      hook: Math.round(raw.scores.hook),
      retentionRisk: Math.round(
        raw.scores.retentionRisk
      ),
    };

    const breakdownValidation = validateScoreBreakdown(
      raw.scoreBreakdown,
      normalizedScores
    );

    if (!breakdownValidation.ok) {
      return null;
    }

    breakdown = breakdownValidation.value;
  }

  const lowestKeys =
    getLowestOverallComponentKeys(breakdown);
  const componentList =
    formatOverallComponentList(lowestKeys, locale);
  const primaryLimitation =
    (locale === "ru"
      ? OVERALL_COMPONENT_REPAIR_LIMITATIONS_RU
      : OVERALL_COMPONENT_REPAIR_LIMITATIONS)[
      lowestKeys[0] ?? "premiseAppeal"
    ];

  return {
    ...raw,
    mainTakeaway:
      locale === "ru"
        ? `Сценарий понятен, но ${componentList} ограничивает общую оценку, потому что ${primaryLimitation}.`
        : `The script is understandable, but its ${componentList} limits the overall score because ${primaryLimitation}.`,
  };
}

function mainTakeawayExplainsLowestOverallComponent(
  mainTakeaway: string,
  breakdown: AnalysisV2ScoreBreakdown,
  locale: AnalysisV2Locale = "en"
): boolean {
  const lowestKeys =
    getLowestOverallComponentKeys(breakdown);

  const componentTerms =
    locale === "ru"
      ? OVERALL_COMPONENT_TAKEAWAY_TERMS_RU
      : OVERALL_COMPONENT_TAKEAWAY_TERMS;
  const limitationTerms =
    locale === "ru"
      ? OVERALL_LIMITATION_TERMS_RU
      : OVERALL_LIMITATION_TERMS;

  const mentionsLowestComponent = lowestKeys.some(
    (key) =>
      componentTerms[key].some(
        (pattern) => pattern.test(mainTakeaway)
      )
  );

  const explainsLimitation =
    limitationTerms.some((pattern) =>
      pattern.test(mainTakeaway)
    );

  return (
    mentionsLowestComponent &&
    explainsLimitation
  );
}

function hasBlanketNoLimitationClaim(
  mainTakeaway: string
): boolean {
  const hasNoLimitationClaim =
    /\b(?:no|without(?:\s+any)?)\s+(?:material|meaningful|significant|major|notable|real)\s+(?:shorts\s+performance\s+)?(?:problems?|issues?|limitations?|weaknesses?)\b/i.test(
      mainTakeaway
    );

  if (!hasNoLimitationClaim) {
    return false;
  }

  const isScopedToOneComponent =
    /\b(?:problems?|issues?|limitations?|weaknesses?)\s+(?:in|with|around)\s+(?:the\s+)?(?:hook|opening|premise|progression|structure|payoff|ending)\b/i.test(
      mainTakeaway
    );

  const includesQualification =
    /\b(?:but|however|although|while|yet|except)\b/i.test(
      mainTakeaway
    );

  return (
    !isScopedToOneComponent &&
    !includesQualification
  );
}

export function validateAnalysisV2Result(
  raw: unknown,
  script: string,
  locale: AnalysisV2Locale = "en"
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
      "scoreBreakdown",
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


  const normalizedScores: AnalysisV2Scores = {
    overall: Math.round(raw.scores.overall),
    hook: Math.round(raw.scores.hook),
    retentionRisk: Math.round(
      raw.scores.retentionRisk
    ),
  };

  let scoreBreakdown:
    | AnalysisV2ScoreBreakdown
    | undefined;

  if (raw.scoreBreakdown !== undefined) {
    const scoreBreakdownValidation =
      validateScoreBreakdown(
        raw.scoreBreakdown,
        normalizedScores
      );

    if (!scoreBreakdownValidation.ok) {
      return scoreBreakdownValidation;
    }

    scoreBreakdown =
      scoreBreakdownValidation.value;
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

    const requestsVerifiedFactualMaterial =
      /\bverified\b/i.test(
        validation.value.suggestion
      ) ||
      // Russian equivalent stem (проверенное/проверенный/...) — \b does not
      // work for Cyrillic, so this is a plain substring check.
      /провер/i.test(validation.value.suggestion);

    const canonicalVerifiedSuggestion =
      requestsVerifiedFactualMaterial
        ? canonicalizeVerifiedFactualSuggestion(
            validation.value.suggestion
          )
        : null;

    if (
      requestsVerifiedFactualMaterial &&
      canonicalVerifiedSuggestion === null
    ) {
      return {
        ok: false,
        reason:
          "A suggested fix requesting verified factual material must use one of the allowed neutral diagnostic forms without extra factual direction.",
      };
    }

    suggestedFixes.push(
      canonicalVerifiedSuggestion
        ? {
            ...validation.value,
            suggestion:
              canonicalVerifiedSuggestion,
          }
        : validation.value
    );
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

  const normalizedMainTakeaway =
    raw.mainTakeaway.trim();

  if (
    normalizedScores.overall < 80 &&
    scoreBreakdown
  ) {
    if (
      hasBlanketNoLimitationClaim(
        normalizedMainTakeaway
      )
    ) {
      return {
        ok: false,
        reason:
          "An overall score below 80 cannot be paired with a mainTakeaway claiming that the script has no material or meaningful limitations.",
      };
    }

    if (
      !mainTakeawayExplainsLowestOverallComponent(
        normalizedMainTakeaway,
        scoreBreakdown,
        locale
      )
    ) {
      return {
        ok: false,
        reason:
          "For an overall score below 80, mainTakeaway must identify the lowest-scoring overall component and explain how it limited the score.",
      };
    }
  }

  const verdict = raw.verdict as AnalysisV2Verdict;
  const overall = raw.scores.overall;
  const retentionRisk = raw.scores.retentionRisk;
  const requiredFixes = suggestedFixes.filter(
    (fix) => !fix.optional
  );

  const hasInvalidResolvedOutcomePayoffCritique =
    raw.scriptType === "narrative_event" &&
    hasResolvedOutcomeNarrative(script) &&
    riskyParts.some(
      (part) =>
        isResolvedOutcomeExcerpt(part.excerpt) &&
        criticizesResolvedOutcomeForMissingExternalMeaning(
          part.reason
        )
    ) &&
    suggestedFixes.some(
      (fix) =>
        !fix.optional &&
        fix.target === "payoff" &&
        requestsExternalNarrativeConsequence(
          fix.suggestion
        )
    );

  if (hasInvalidResolvedOutcomePayoffCritique) {
    return {
      ok: false,
      reason:
        "A resolved outcome narrative cannot be treated as missing payoff solely because it lacks an external consequence or significance.",
    };
  }

  const causalExplanationFeedback = [
    raw.hookAssessment,
    raw.mainTakeaway,
    ...riskyParts.map((part) => part.reason),
    ...suggestedFixes.map(
      (fix) => fix.suggestion
    ),
    ...scenes.map((scene) => scene.label),
  ];

  const hasInvalidUnpunctuatedExplanationCritique =
    raw.scriptType === "explanation" &&
    hasUnpunctuatedCompleteCausalExplanation(script) &&
    causalExplanationFeedback.some(
      (feedback) =>
        criticizesCompleteCausalExplanationForMissingDepth(
          feedback
        ) ||
        requestsUnnecessaryCausalExpansion(
          feedback
        )
    );

  if (hasInvalidUnpunctuatedExplanationCritique) {
    return {
      ok: false,
      reason:
        "A complete causal explanation in an unpunctuated script cannot be treated as missing mechanism solely because it could include more detail or examples.",
    };
  }

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

  if (
    raw.scriptType === "list_escalation" &&
    looksLikeComparisonInsteadOfEscalation(script)
  ) {
    return {
      ok: false,
      reason:
        "A side-by-side evaluation with a shared measurement and declared winner must be classified as comparison, not list_escalation.",
    };
  }

  if (
    raw.scriptType === "list_escalation" &&
    looksLikeParallelAdviceInsteadOfEscalation(script)
  ) {
    return {
      ok: false,
      reason:
        "A parallel list of habits, tips, steps, or instructions without demonstrated escalation must be classified as how_to or generic_advice, not list_escalation.",
    };
  }

  const requiresGenericAdviceDiagnostic =
    raw.scriptType === "generic_advice" &&
    !hasConcreteAnchorForGenericAdvice(script);

  if (
    requiresGenericAdviceDiagnostic &&
    normalizedHookDecision !== "diagnostic"
  ) {
    return {
      ok: false,
      reason:
        "Generic advice without a concrete example, number, named situation, mechanism, or observable result requires a diagnostic hook decision.",
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

  if (
    hasUnrevealedSpecificOpeningPromise(script) &&
    (
      normalizedHookDecision === "keep" ||
      overall > 65 ||
      retentionRisk < 40 ||
      riskyParts.length === 0
    )
  ) {
    return {
      ok: false,
      reason:
        "An unrevealed specific opening promise cannot be treated as clear, low-risk, or keep-worthy.",
    };
  }

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
      ...(scoreBreakdown
        ? {
            scoreBreakdown,
          }
        : {}),
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
      mainTakeaway: normalizedMainTakeaway,
    },
  };
}

export function validateAnalysisV2ModelResult(
  raw: unknown,
  script: string,
  locale: AnalysisV2Locale = "en"
): AnalysisV2ResultValidation {
  if (
    !isPlainObject(raw) ||
    !Object.prototype.hasOwnProperty.call(
      raw,
      "scoreComponents"
    )
  ) {
    // Backward compatibility for existing deterministic tests
    // and already-stored public AnalysisV2 results.
    return validateAnalysisV2Result(raw, script, locale);
  }

  const requiredRootKeys = [
    "scriptType",
    "verdict",
    "scoreComponents",
    "hookDecision",
    "hookAssessment",
    "suggestedHook",
    "riskyParts",
    "suggestedFixes",
    "scenes",
    "mainTakeaway",
  ] as const;

  if (!hasExactlyKeys(raw, requiredRootKeys)) {
    return {
      ok: false,
      reason:
        "The model response must contain exactly the required component-scoring fields.",
    };
  }

  if (!isPlainObject(raw.scoreComponents)) {
    return {
      ok: false,
      reason: "scoreComponents must be an object.",
    };
  }

  if (
    !hasExactlyKeys(raw.scoreComponents, [
      "overall",
      "hook",
      "retentionRisk",
    ])
  ) {
    return {
      ok: false,
      reason:
        "scoreComponents must contain exactly overall, hook, and retentionRisk.",
    };
  }

  const overallValidation =
    validateScoreComponentGroup(
      raw.scoreComponents.overall,
      ANALYSIS_V2_SCORE_COMPONENT_KEYS.overall,
      "scoreComponents.overall"
    );

  if (!overallValidation.ok) {
    return overallValidation;
  }

  const hookValidation =
    validateScoreComponentGroup(
      raw.scoreComponents.hook,
      ANALYSIS_V2_SCORE_COMPONENT_KEYS.hook,
      "scoreComponents.hook"
    );

  if (!hookValidation.ok) {
    return hookValidation;
  }

  const retentionRiskValidation =
    validateScoreComponentGroup(
      raw.scoreComponents.retentionRisk,
      ANALYSIS_V2_SCORE_COMPONENT_KEYS.retentionRisk,
      "scoreComponents.retentionRisk"
    );

  if (!retentionRiskValidation.ok) {
    return retentionRiskValidation;
  }

  const publicResult = {
    scriptType: raw.scriptType,
    verdict: raw.verdict,
    scores: {
      overall: sumScoreComponentGroup(
        overallValidation.value,
        ANALYSIS_V2_SCORE_COMPONENT_KEYS.overall
      ),
      hook: sumScoreComponentGroup(
        hookValidation.value,
        ANALYSIS_V2_SCORE_COMPONENT_KEYS.hook
      ),
      retentionRisk: sumScoreComponentGroup(
        retentionRiskValidation.value,
        ANALYSIS_V2_SCORE_COMPONENT_KEYS.retentionRisk
      ),
    },
    scoreBreakdown: createScoreBreakdown(
      overallValidation.value,
      hookValidation.value,
      retentionRiskValidation.value
    ),
    hookDecision: raw.hookDecision,
    hookAssessment: raw.hookAssessment,
    suggestedHook: raw.suggestedHook,
    riskyParts: raw.riskyParts,
    suggestedFixes: raw.suggestedFixes,
    scenes: raw.scenes,
    mainTakeaway: raw.mainTakeaway,
  };

  return validateAnalysisV2Result(
    publicResult,
    script,
    locale
  );
}
