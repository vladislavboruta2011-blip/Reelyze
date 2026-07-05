// Ranking and list-buildup detectors used by the structural scoring analysis.

// Keep ranking-specific regexes and thresholds isolated from other script structures.

export interface RankingStructures {
  hasListBuildup: boolean;
  hasRankingCulmination: boolean;
}

export function detectRankingStructures(
  lines: string[],
  fullText: string
): RankingStructures {
  const lower = fullText.toLowerCase();
  const totalLines = lines.length;

  // ── List buildup ──────────────────────────────────────────────────────────
  const bodyLines = lines.slice(1);
  let consecutiveShortLines = 0;
  let maxConsecutiveShort = 0;
  for (const line of bodyLines) {
    const wc = line.split(/\s+/).filter(Boolean).length;
    if (wc <= 9) {
      consecutiveShortLines++;
      maxConsecutiveShort = Math.max(maxConsecutiveShort, consecutiveShortLines);
    } else {
      consecutiveShortLines = 0;
    }
  }
  const hasEscalationFollowUp =
    lower.includes("now imagine") || lower.includes("now think") ||
    lower.includes("millions") || lower.includes("permanent") ||
    lower.includes("once it") || lower.includes("you do not control") ||
    lower.includes("you lose control") || lower.includes("that is what") ||
    lower.includes("that is why");

  // Detect whether the short lines are concrete items (list buildup) vs generic filler.
  // Generic filler lines contain no specific nouns, numbers, or named objects.
  const concreteShortLineCount = bodyLines.filter(line => {
    const wc = line.split(/\s+/).filter(Boolean).length;
    if (wc > 9) return false;
    const ll = line.toLowerCase();

    return (
      // Any number makes a short line concrete
      /\d/.test(line) ||
      // Any unit of measurement (universal)
      /\b(percent|%|mile|foot|feet|meter|second|minute|hour|day|week|year|degree|kilogram|pound|dollar|euro|cent|billion|million|thousand|km|mph|kph)\b/i.test(ll) ||
      // Named entity MID-SENTENCE only — sentence-initial capitalization
      // (every sentence) must not count, or every line becomes "concrete".
      /[a-z,]\s+[A-Z][a-z]{2,}/.test(line) ||
      // Any concrete physical noun (universal — detects objects in any niche)
      /\b(table|floor|ground|wall|door|window|seat|screen|phone|bag|box|car|ship|boat|plane|building|room|street|road|field|stage|court|ring|track|lab|office|store|market|hospital|school|station|airport)\b/i.test(ll)
    );
  }).length;

  // Repeated samples of one subject across time or distance are progression,
  // not a list of competing options.
  const repeatedContextPattern =
    /^(?:(?:on|during)\s+(?:(?:day|week|month|year|hour|minute|second)\s+[a-z0-9-]+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|at\s+\d[\d,.]*\s*(?:meters?|kilometers?|miles?|feet|yards?|seconds?|minutes?|hours?)\b|(?:day|week|month|year|hour|minute|second)\s+[a-z0-9-]+\b)/i;

  const repeatedContextLineCount = bodyLines.filter((line) =>
    repeatedContextPattern.test(line.trim())
  ).length;

  const hasRepeatedContextSeries = repeatedContextLineCount >= 3;

  // Ranked comparisons can form a list even when individual lines are longer
  // than the normal short-line threshold or use ordinary lowercase subjects.
  const rankedComparisonSubjects = new Set<string>();
  let comparisonLineCount = 0;

  const comparisonMarkerPattern =
    /\b(higher|lower|further|farther|faster|slower|longer|shorter|better|worse|stronger|weaker|larger|smaller|closer|close to|above|below|ahead|behind|more than|less than|almost|nearly|even higher|slightly above|slightly below|beats?|wins?|remains ahead)\b/i;

  const comparisonSubjectPattern =
    /^(?:but\s+|and\s+|against\s+)?((?:the\s+)?[A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,3}?)\s+(?:is|are|was|were|beats?|wins?|finishes?|ranks?|places?|comes?|remains?|stays?|jumps?|runs?|moves?|travels?|lasts?|uses?|reaches?)\b/i;

  // Auto-caption normalization can split one semantic comparison sentence
  // into mechanical chunks, so inspect every normalized line.
  for (const line of lines) {
    const trimmed = line.trim();
    const lineLower = trimmed.toLowerCase();

    if (!comparisonMarkerPattern.test(lineLower)) continue;

    comparisonLineCount += 1;

    const ordinarySubjectMatch = trimmed.match(comparisonSubjectPattern);
    if (ordinarySubjectMatch) {
      rankedComparisonSubjects.add(
        ordinarySubjectMatch[1].toLowerCase()
      );
    }

    const namedSubjectMatch = trimmed.match(
      /^(?:against\s+|but\s+|and\s+)?([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,3})\b/
    );

    if (namedSubjectMatch) {
      rankedComparisonSubjects.add(
        namedSubjectMatch[1].toLowerCase()
      );
    }

    // Detect several compared subjects inside one long sentence:
    // "higher than A, below B, ahead of C".
    const inlineSubjectPattern =
      /\b(?:than|above|below|ahead of|behind|against|beats?)\s+([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,3})\b/g;

    for (const match of trimmed.matchAll(inlineSubjectPattern)) {
      rankedComparisonSubjects.add(
        match[1].toLowerCase()
      );
    }
  }

  const hasComparativeChain =
    !hasRepeatedContextSeries &&
    comparisonLineCount >= 3 &&
    rankedComparisonSubjects.size >= 3;

  const hasRankedComparisonBuildup =
    !hasRepeatedContextSeries &&
    rankedComparisonSubjects.size >= 3;

  const hasListBuildup =
    hasRankedComparisonBuildup ||
    hasComparativeChain ||
    (
      !hasRepeatedContextSeries &&
      (
        (maxConsecutiveShort >= 3 && concreteShortLineCount >= 2) ||
        (maxConsecutiveShort >= 2 && hasEscalationFollowUp && concreteShortLineCount >= 1)
      )
    );

  // Numeric ranking culmination: the ending itself contains a measured option
  // whose value is a strict maximum or minimum among at least three predecessors.
  const measuredOptionLines = bodyLines.flatMap((line, lineIndex) => {
    const numericMatches = Array.from(
      line.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)
    );
    const measurement = numericMatches.at(-1);

    if (!measurement) return [];

    const value = Number(measurement[0].replace(/,/g, ""));
    if (!Number.isFinite(value)) return [];

    return [{ lineIndex, value }];
  });

  const finalMeasuredOption = measuredOptionLines.at(-1);
  const priorMeasuredValues = measuredOptionLines
    .slice(0, -1)
    .map((item) => item.value);

  const finalMeasurementIsStrictExtreme =
    finalMeasuredOption !== undefined &&
    priorMeasuredValues.length >= 3 &&
    (
      finalMeasuredOption.value > Math.max(...priorMeasuredValues) ||
      finalMeasuredOption.value < Math.min(...priorMeasuredValues)
    );

  const hasNumericRankingCulmination =
    hasListBuildup &&
    !hasRepeatedContextSeries &&
    measuredOptionLines.length >= 4 &&
    finalMeasuredOption?.lineIndex === bodyLines.length - 1 &&
    finalMeasurementIsStrictExtreme;

  // Comparative culmination: the final option is compared against the entire
  // remaining set rather than merely against one previous item.
  const rankingEndingLine = (lines[totalLines - 1] ?? "").toLowerCase();
  const endingHasUniversalComparisonScope =
    /\b(?:every|any)\s+other\b|\ball\s+(?:of\s+)?(?:the\s+)?others?\b|\bthe rest\b|\beveryone else\b|\beverything else\b/.test(
      rankingEndingLine
    );

  const hasComparativeRankingCulmination =
    hasComparativeChain &&
    comparisonMarkerPattern.test(rankingEndingLine) &&
    endingHasUniversalComparisonScope;

  const hasRankingCulmination =
    hasNumericRankingCulmination ||
    hasComparativeRankingCulmination;

  return {
    hasListBuildup,
    hasRankingCulmination,
  };
}
