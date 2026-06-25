import { readFileSync } from "node:fs";

const homeSource = readFileSync("app/page.tsx", "utf8");
const resultsSource = readFileSync(
  "app/results/page.tsx",
  "utf8"
);

let failures = 0;

function check(condition: boolean, message: string): void {
  if (condition) {
    console.log(`✅ PASS — ${message}`);
  } else {
    console.error(`❌ FAIL — ${message}`);
    failures += 1;
  }
}

console.log("\nAnalysis V2 Production Integration Tests\n");

const analyzeHandlerStart = homeSource.indexOf(
  "function handleAnalyze()"
);
const analyzeHandlerEnd =
  analyzeHandlerStart >= 0
    ? homeSource.indexOf(
        "\n  return (",
        analyzeHandlerStart
      )
    : -1;
const analyzeHandler =
  analyzeHandlerStart >= 0 &&
  analyzeHandlerEnd > analyzeHandlerStart
    ? homeSource.slice(
        analyzeHandlerStart,
        analyzeHandlerEnd
      )
    : "";

const fetchIndex = analyzeHandler.indexOf(
  'fetch("/api/analyze-v2"'
);
const responseJsonIndex = analyzeHandler.indexOf(
  "payload = await response.json()"
);
const responseOkIndex = analyzeHandler.indexOf(
  "if (!response.ok)"
);
const validationIndex = analyzeHandler.indexOf(
  "!isAnalysisV2SuccessResponse("
);
const analysisWriteIndex = analyzeHandler.indexOf(
  "ANALYSIS_V2_STORAGE_KEY,\n          JSON.stringify(payload)"
);
const navigationIndex = analyzeHandler.indexOf(
  'router.push("/results")'
);

check(
  homeSource.split('fetch("/api/analyze-v2"').length - 1 === 1,
  "Analyze uses exactly one Analysis V2 request path"
);

check(
  fetchIndex >= 0 &&
    responseJsonIndex > fetchIndex &&
    responseOkIndex > responseJsonIndex &&
    validationIndex > responseOkIndex,
  "API payload is parsed, status-checked, and validated in order"
);

check(
  analyzeHandler.includes(
    "isAnalysisV2SuccessResponse(\n            payload,\n            cleanedScript"
  ),
  "Successful responses are validated against the submitted script"
);

check(
  analysisWriteIndex > validationIndex &&
    navigationIndex > analysisWriteIndex,
  "Validated analysis is stored before navigating to Results"
);

check(
  analyzeHandler.includes(
    'restoreSessionValue(\n            "reelyze-script",\n            previousScript'
  ) &&
    analyzeHandler.includes(
      'restoreSessionValue(\n            "reelyze-title",\n            previousTitle'
    ) &&
    analyzeHandler.includes(
      "restoreSessionValue(\n            ANALYSIS_V2_STORAGE_KEY,\n            previousAnalysis"
    ),
  "Storage failures restore script, title, and Analysis V2 data"
);

check(
  resultsSource.includes(
    "const storedAnalysis = sessionStorage.getItem(\n          ANALYSIS_V2_STORAGE_KEY"
  ) &&
    resultsSource.includes(
      "parseStoredAnalysisV2(\n                storedAnalysis,\n                storedScript.trim()"
    ),
  "Results loads and revalidates the stored Analysis V2 response"
);

check(
  resultsSource.includes(
    "!isValidStoredScript ||\n          !isValidStoredTitle ||\n          parsedAnalysis === null"
  ),
  "Results rejects missing or invalid Analysis V2 data"
);

check(
  resultsSource.includes(
    "return adaptAnalysisV2ForResults(\n        savedAnalysisV2,\n        activeScript,\n        scriptLines,\n        estimatedDuration"
  ),
  "Results adapts Analysis V2 into the existing production UI"
);

if (failures > 0) {
  console.error(
    `\nResult: ${failures} integration test(s) failed.\n`
  );
  process.exitCode = 1;
} else {
  console.log(
    "\nResult: all Analysis V2 production integration tests passed.\n"
  );
}
