import assert from "node:assert/strict";

import { buildAnalysisV2SystemPrompt } from "../engine/analysis-v2-prompt";

const prompt = buildAnalysisV2SystemPrompt();

const requiredRules = [
  {
    name: "one material problem should receive one suggested fix",
    text: "If one actionable change resolves all material problems, return one suggestedFix.",
  },
  {
    name: "two independent problems should receive two suggested fixes",
    text: "If the script has two materially different problems that require different changes, return two suggestedFixes.",
  },
  {
    name: "shared root causes should be merged",
    text: "If multiple riskyParts share the same root cause, merge them into one riskyPart unless they require materially different changes.",
  },
  {
    name: "shared root causes should use one shared fix",
    text: "If one actionable change resolves multiple riskyParts, return one suggestedFix that addresses the shared root cause.",
  },
  {
    name: "the model must not invent a second fix",
    text: "Do not create a second suggestedFix merely to fill the available limit.",
  },
  {
    name: "hook evaluation must use only the opening hook",
    text: "Evaluate hookAssessment and hookDecision using only the opening hook, not unrelated material from later in the script.",
  },
  {
    name: "unfulfilled late promises must be treated as payoff problems",
    text: "Treat an explicit promise near the end as a material payoff problem when the promised information is not delivered anywhere in the script.",
  },
  {
    name: "independent unfulfilled promises need separate feedback",
    text: "If an unfulfilled promise is independent from another material problem, report it as a separate riskyPart with a separate suggestedFix.",
  },
  {
    name: "suggested hooks must not repeat and re-promise the same explanation",
    text: "A suggestedHook must not state the explanation and then promise to explain that same explanation.",
  },
  {
    name: "later specificity must not hide generic first-sentence filler",
    text: "Evaluate the first sentence independently. If it is generic filler that delays the concrete subject, premise, problem, or promise, treat it as a material hook weakness even when a later opening sentence is specific.",
  },
  {
    name: "generic opening filler needs grounded hook feedback",
    text: "When generic filler appears before the concrete premise, quote the filler sentence as a riskyPart and include a non-optional suggestedFix with target hook.",
  },
  {
    name: "generic opening filler cannot receive a strong result",
    text: "If generic opening filler delays the concrete premise, verdict must not be strong, riskyParts must not be empty, and overall must not exceed 84.",
  },
  {
    name: "generic opening filler requires a mandatory hook fix",
    text: "For generic opening filler, hookDecision must be refine or rewrite and the suggestedFix with target hook must have optional set to false.",
  },
  {
    name: "unsupported absolute promise cannot be praised as clear",
    text: "When an opening hook makes an unsupported absolute promise, do not describe the hook as strong, fairly strong, clear and specific, or already effective in hookAssessment.",
  },
  {
    name: "named frameworks are not automatically concrete",
    text: "Named steps, mnemonic labels, or a polished framework are not automatically useful or concrete.",
  },
  {
    name: "tautological framework explanations are material weaknesses",
    text: "If each step's explanation merely restates its label without adding a mechanism, example, decision rule, specific action, or observable result, treat that as a material content and payoff weakness; verdict must not be strong, riskyParts must not be empty, and include a non-optional suggestedFix.",
  },
  {
    name: "unfulfilled novelty promises are material weaknesses",
    text: "If the script claims that familiar advice is overlooked, secret, unknown, surprising, or unique but only delivers conventional points without a less-obvious mechanism, contrast, example, observation, or application, treat that as a material hook and payoff weakness.",
  },
  {
    name: "novelty claims do not require external proof",
    text: "Do not request verified evidence, external proof, new research, measurable results, or additional facts merely to prove that conventional advice is overlooked, secret, surprising, unique, or rarely discussed.",
  },
  {
    name: "unsupported novelty wording should be softened",
    text: "When the script does not already contain supported less-obvious material, the grounded correction is to remove or soften the novelty wording using claims already present in the script.",
  },
  {
    name: "familiar topics are not automatically unoriginal",
    text: "Do not penalize a script merely because its topic is familiar or popular. A familiar topic can still be strong when it provides a concrete mechanism, useful contrast, specific example, actionable application, or observable result.",
  },
  {
    name: "parallel advice lists are not list escalation",
    text: "Use list_escalation only when the examples, events, or results demonstrably intensify along a shared dimension. A numbered or grouped list of parallel tips, habits, or steps without escalation should normally be how_to or generic_advice, not list_escalation.",
  },
  {
    name: "short paraphrases do not make frameworks concrete",
    text: "A polished framework is still materially weak when its explanations only define or paraphrase the labels. Short glosses such as reviewing shows what happened, reflecting helps you understand it, or refining helps you improve do not count as a mechanism, example, decision rule, specific action, or observable result.",
  },
  {
    name: "a numbered advice list does not create escalation",
    text: "A count such as three habits, five tips, or seven steps does not create escalation. Ordering words such as first, then, and finally also do not create escalation by themselves.",
  },
  {
    name: "overall score reflects Shorts performance potential",
    text: "Overall score must reflect Shorts performance potential, not just writing quality.",
  },
  {
    name: "clear educational structure is not enough for a very high score",
    text: "A script should not receive a very high overall score merely because it is clear, logical, educational, or well structured.",
  },
  {
    name: "low-interest topics should produce an overall total below 80",
    text: "A well-structured script with a low-interest topic, weak stakes, no meaningful curiosity gap, and an informative-but-unsurprising payoff should produce an overall component total below 80.",
  },
  {
    name: "an overall total of 85 plus requires strong execution and premise appeal",
    text: "An overall component total of 85 or higher should be reserved for scripts that combine strong execution with a genuinely compelling Shorts idea.",
  },
  {
    name: "educational content can still score high with real pull",
    text: "Do not punish educational content when the angle creates real surprise, conflict, personal relevance, mystery, or emotional stakes.",
  },
  {
    name: "premise appeal is evaluated separately from execution",
    text: "Evaluate the underlying premise separately from writing quality and structure.",
  },
  {
    name: "clear factual information is not automatically compelling",
    text: "Ask whether a broad Shorts viewer has a meaningful reason to keep watching beyond receiving a clear factual statement.",
  },
  {
    name: "specificity alone does not create premise appeal",
    text: "Specificity, named entities, numbers, and polished wording do not by themselves make the premise compelling.",
  },
  {
    name: "materially weak premises cannot receive a strong verdict",
    text: "If the premise is materially weak:",
  },
  {
    name: "main takeaway identifies premise limitations",
    text: "mainTakeaway must explain that the main limitation is the underlying angle or audience pull, not merely the writing",
  },
  {
    name: "strong gate checks premise and execution",
    text: "Does this script have a material Shorts performance problem in its underlying premise or in how that premise is executed?",
  },
  {
    name: "analysis scope includes premise appeal",
    text: "evaluate only the submitted script's premise appeal, structure, clarity, promise, progression, payoff, and likely Shorts performance",
  },
  {
    name: "subject fame does not prove premise appeal",
    text: "Do not infer strong premise appeal from the fame, scale, or inherent interest of the subject alone.",
  },
  {
    name: "interesting facts still require a meaningful viewer reward",
    text: "A fact being technically surprising or easy to describe as interesting is not enough.",
  },
  {
    name: "minor facts without implications are materially weak",
    text: "If the script's entire viewer reward is learning that a minor factual change occurs, and the payoff mainly minimizes that change without showing why it matters, classify the premise as materially weak.",
  },
  {
    name: "weak minor-fact premises stay below 80",
    text: "In that case, verdict must be mixed or weak and overall must stay below 80.",
  },
  {
    name: "clarity is not evidence of audience pull",
    text: "Do not use clear, specific, factual, or interesting as substitutes for evidence of audience pull.",
  },
  {
    name: "analysis diagnoses the root cause",
    text: "Diagnose the root cause of the performance limitation, not merely the easiest sentence or secondary detail to criticize.",
  },
  {
    name: "weak premises must not be praised as engaging",
    text: "do not describe the premise as strong, engaging, compelling, interesting, or already effective",
  },
  {
    name: "premise weakness must not become a detail problem",
    text: "do not reframe the root problem as insufficient detail, a missing mechanism, or an underexplained secondary point unless that missing material would itself create a meaningful viewer reward",
  },
  {
    name: "main takeaway attributes low premise appeal correctly",
    text: "mainTakeaway must identify limited audience pull, a weak angle, or an insufficient viewer reward as the central limitation",
  },
  {
    name: "low-value details should not simply be expanded",
    text: "do not recommend expanding a low-value detail merely to make the explanation longer",
  },
  {
    name: "premise fixes strengthen supported viewer value",
    text: "prefer strengthening a supported consequence, contrast, implication, tension, practical utility, or magnitude already present in the script",
  },
  {
    name: "initial hook curiosity is separate from full premise appeal",
    text: "A clear opening fact may create initial curiosity while the full script still lacks a meaningful viewer reward.",
  },
  {
    name: "hook praise does not prove the full premise is strong",
    text: "HookAssessment may recognize genuine opening curiosity, but that alone must not cause mainTakeaway to describe the complete premise as strong, engaging, compelling, or effective.",
  },
  {
    name: "premise fixes cannot invent specific consequences",
    text: "do not propose a specific consequence, affected group, danger, environmental effect, social impact, practical application, or comparison unless it is supported by the submitted script",
  },
  {
    name: "missing factual material receives a diagnostic fix",
    text: "when stronger factual material is missing, state that a verified consequence, contrast, implication, or magnitude is needed rather than supplying a possible one yourself",
  },
  {
    name: "below-80 takeaways identify the lowest overall component",
    text: "mainTakeaway must identify the lowest-scoring Overall component as the main reason points were lost",
  },
  {
    name: "below-80 takeaways cannot deny all limitations",
    text: "do not claim that the script has no material, meaningful, significant, major, or notable problems, issues, limitations, or weaknesses",
  },
  {
    name: "strong below-80 results explain a non-material limitation",
    text: "describe the lowest-scoring component as the main non-material limitation or clearest opportunity holding the score below 80",
  },
  {
    name: "honest warning uncertainty is not automatically a weakness",
    text: "Honest uncertainty about an unsettled mechanism is not a material weakness when the warning remains clear, appropriately qualified, and actionable.",
  },
  {
    name: "cautious warning advice is a valid payoff",
    text: "A cautious practical or harm-reduction recommendation is a valid payoff.",
  },
  {
    name: "warning uncertainty and action are not split unnecessarily",
    text: "Do not split appropriate scientific uncertainty and a cautious practical recommendation into two separate material problems when both support the same clear warning.",
  },
  {
    name: "suggested fixes remain globally grounded",
    text: "Suggested fixes must remain grounded in the submitted script.",
  },
  {
    name: "grounded fixes do not invent missing facts",
    text: "It must not invent what that consequence, contrast, implication, example, or result should be.",
  },
  {
    name: "missing factual material receives generic diagnostic guidance",
    text: "When the script lacks the factual material needed for a stronger angle or payoff, the suggestedFix must remain diagnostic and generic.",
  },
  {
    name: "missing factual material cannot receive candidate facts",
    text: "It must not propose candidate facts or possible factual directions.",
  },
  {
    name: "external research fixes use constrained wording",
    text: "If the missing material would require external research, use one of these exact forms and stop:",
  },
  {
    name: "diagnostic fixes cannot append examples",
    text: "Do not add another sentence or append an example, candidate topic, affected group, possible effect, or clause beginning with \"such as\", \"for example\", \"including\", or \"like\".",
  },
  {
    name: "unsupported factual directions are removed",
    text: "Before returning each suggestedFix, remove every concrete factual direction that is not already stated in the submitted script.",
  },
  {
    name: "moderate educational appeal does not imply major failure",
    text: "A clear, accurate, self-contained script with a concrete opening, coherent progression, and a fulfilled promise should generally not produce a derived overall total below 55 merely because its topic has moderate rather than broad audience appeal.",
  },
  {
    name: "limited premise appeal mainly affects its own component",
    text: "Limited premise appeal should mainly reduce scoreComponents.overall.premiseAppeal.",
  },
  {
    name: "fulfilled execution components are preserved",
    text: "Do not automatically reduce openingPromise, progression, or payoff when those elements are clear, accurate, and fulfilled.",
  },
  {
    name: "modest audience breadth is not retention risk",
    text: "Limited audience breadth or a modest topic is not itself retention risk.",
  },
  {
    name: "warning uncertainty is not automatically weak",
    text: "cautious wording about an association, risk, or still-uncertain mechanism is not automatically a weakness",
  },
  {
    name: "clear cautious action remains a valid payoff",
    text: "a concrete action such as cutting back, replacing some use, avoiding a behavior, or seeking help is not vague merely because it avoids an absolute command",
  },
  {
    name: "warning feedback is not split by one root issue",
    text: "do not split one supposed warning-payoff limitation into separate riskyParts for uncertainty and practical advice when both describe the same root issue",
  },
  {
    name: "resolved survival can complete a narrative payoff",
    text: "A final statement confirming that the affected people survived can be a meaningful payoff when the script has already shown injuries, escalating danger, or a narrowly avoided worse outcome.",
  },
  {
    name: "resolved chronology does not require external consequences",
    text: "Do not require a later policy change, historical consequence, broader implication, security response, or separate explanation of significance when the chronology itself establishes why the resolved outcome matters.",
  },
  {
    name: "survival payoff does not create a risky part by itself",
    text: "Do not create a riskyPart solely because a resolved survival outcome does not add another external consequence.",
  },
  {
    name: "unresolved mystery can be the intended payoff",
    text: "an unresolved outcome can be the intended payoff when the script builds concrete clues and clearly states that the event remains unexplained",
  },
  {
    name: "mysteries do not require invented factual closure",
    text: "do not request a verified explanation, cause, consequence, or factual resolution merely because the real-world mystery remains unresolved",
  },
  {
    name: "high-level explanations can be sufficient",
    text: "a clear high-level causal explanation can be sufficient even when it does not include microscopic, technical, historical, genetic, or scientific detail",
  },
  {
    name: "expandability does not prove vagueness",
    text: "do not call an explanation vague merely because it could be expanded with more detail",
  },
  {
    name: "deeper mechanism requires a real explanatory failure",
    text: "require deeper mechanism only when the current explanation is circular, contradictory, unintelligible, or fails to answer the promise made by the opening",
  },
  {
    name: "clarity does not guarantee strong premise appeal",
    text: "sufficient explanatory clarity does not automatically create strong premise appeal or a compelling Shorts payoff",
  },
  {
    name: "fulfilled factual promises may still have modest viewer reward",
    text: "a script may clearly fulfill its factual promise while still having only modest viewer reward, stakes, surprise, relevance, or broader appeal",
  },
  {
    name: "limited viewer reward is diagnosed once",
    text: "if limited viewer reward is the material weakness, identify that root limitation once instead of separately criticizing mechanism depth, premise appeal, and payoff",
  },
  {
    name: "explanation fixes cannot prescribe unsupported directions",
    text: "do not invent or prescribe a specific cultural, genetic, historical, scientific, social, or appearance-related direction",
  },
  {
    name: "missing explanation material uses neutral diagnostics",
    text: "when stronger factual material is genuinely needed, use the allowed neutral verified diagnostic form without appending candidate directions",
  },
  {
    name: "one root explanation problem receives one risky part",
    text: "when one root limitation explains the result, use at most one riskyPart and one required suggestedFix",
  },
  {
    name: "practical causal mechanisms can complete a how-to payoff",
    text: "A concrete action paired with a direct causal mechanism and practical benefit can be a complete how-to payoff even when no separate example is included.",
  },
  {
    name: "physical distance and behavioral pause form a concrete mechanism",
    text: "A causal chain such as increasing physical distance → creating a pause → making an unwanted action easier to resist is already a concrete mechanism, not a vague claim.",
  },
  {
    name: "complete practical mechanisms do not require extra examples",
    text: "Do not require an additional example, deeper psychological explanation, study, measurement, or technical detail merely because the existing practical mechanism could be expanded.",
  },
  {
    name: "one practical mechanism is not split into multiple risks",
    text: "Do not split one complete action-and-mechanism chain into separate riskyParts for the action, the mechanism, and the payoff.",
  },
  {
    name: "missing punctuation is not missing content",
    text: "missing punctuation alone is a readability or delivery issue, not evidence that the premise, mechanism, progression, or payoff is missing",
  },
  {
    name: "complete causal explanations survive auto-caption formatting",
    text: "if the text still communicates a complete causal chain that answers the opening promise, do not call it shallow, vague, incomplete, or lacking depth merely because the clauses run together",
  },
  {
    name: "punctuation issues remain clarity issues",
    text: "if punctuation materially harms comprehension, identify at most one clarity or delivery issue; do not convert it into a content, premise, or payoff failure",
  },
  {
    name: "bracketed transcript cues are non-semantic",
    text: "treat bracketed transcription cues such as [music], [applause], [noise], or [sound] as non-semantic markers rather than missing content",
  },
  {
    name: "transcript cues are removed before causal evaluation",
    text: "mentally remove bracketed transcription cues only when evaluating whether the meaningful words contain a cause, effect, progression, and resolution",
  },
  {
    name: "leading filler does not erase a later mechanism",
    text: "a leading conversational filler phrase such as \"so basically\" may create one hook clarity issue, but it does not prove that the later mechanism or payoff is missing",
  },
  {
    name: "complete auto-caption explanations preserve fulfilled components",
    text: "if the causal explanation remains complete after removing filler and transcript cues, target only the filler or formatting issue and preserve the fulfilled explanation components",
  },
  {
    name: "complete auto-caption explanations do not need extra consequences",
    text: "do not request an additional example, deeper mechanism, more detailed explanation, extra consequence, or further factual expansion",
  },
  {
    name: "semantic transcript removal does not alter excerpts",
    text: "semantic removal does not permit deleting, skipping, normalizing, or paraphrasing those cues inside riskyParts or scenes excerpts",
  },
  {
    name: "transcript excerpts cannot join non-contiguous text",
    text: "never join words from opposite sides of a transcription cue into one excerpt unless that full text, including the cue, exists contiguously in the submitted script",
  },
  {
    name: "grounded excerpts preserve bracketed markers",
    text: "If an excerpt crosses a bracketed transcription cue such as [music], copy that cue exactly inside the excerpt or split the content into separate exact contiguous excerpts.",
  },
  {
    name: "strong scripts may omit optional refinements",
    text: "suggestedFixes may be empty or contain one genuinely optional refinement grounded in a specific opportunity",
  },
  {
    name: "lower strong scores do not require filler feedback",
    text: "do not create an optional refinement merely because the overall score is below 85",
  },
  {
    name: "score components are calibrated before verdict",
    text: "Calibrate the score components from evidence before choosing the verdict.",
  },
  {
    name: "verdict is not a score template",
    text: "The verdict summarizes the evidence; it must not act as a preset score template.",
  },
  {
    name: "model returns components instead of scores",
    text: "Return scoreComponents instead of final scores.",
  },
  {
    name: "server derives public scores",
    text: "The server derives each public score by adding its four components.",
  },
  {
    name: "components use bounded integers",
    text: "Use integer component values from 0 through 25.",
  },
  {
    name: "component multiples of five are discouraged",
    text: "Do not default component values to multiples of five, familiar totals, or repeated patterns associated with a verdict.",
  },
  {
    name: "overall premise component is explicit",
    text: "scoreComponents.overall.premiseAppeal",
  },
  {
    name: "overall progression component is explicit",
    text: "scoreComponents.overall.progression",
  },
  {
    name: "overall payoff component is explicit",
    text: "scoreComponents.overall.payoff",
  },
  {
    name: "hook immediacy component is explicit",
    text: "scoreComponents.hook.immediacy",
  },
  {
    name: "hook viewer pull component is explicit",
    text: "scoreComponents.hook.viewerPull",
  },
  {
    name: "hook delivery alignment component is explicit",
    text: "scoreComponents.hook.deliveryAlignment",
  },
  {
    name: "opening friction risk is explicit",
    text: "scoreComponents.retentionRisk.openingFriction",
  },
  {
    name: "progression risk is explicit",
    text: "scoreComponents.retentionRisk.progressionRisk",
  },
  {
    name: "payoff risk is explicit",
    text: "scoreComponents.retentionRisk.payoffRisk",
  },
  {
    name: "final scores are omitted from model output",
    text: "Do not return final overall, hook, or retentionRisk values.",
  },
  {
    name: "component arithmetic is not narrated",
    text: "Do not output arithmetic or explanatory component calculations.",
  },
  {
    name: "components do not start from verdict",
    text: "Do not choose components by starting from the verdict or a preferred total.",
  },
  {
    name: "retention risk is not an inverse",
    text: "Do not construct retention risk as the inverse of overall or hook.",
  },
  {
    name: "different evidence requires different components",
    text: "When scripts differ on one or more components, reflect that difference instead of collapsing them to the same familiar pattern.",
  },
  {
    name: "same-verdict scripts can remain separated",
    text: "Scripts with the same verdict may still need clearly separated component totals when their premise appeal, opening strength, progression, or payoff materially differs.",
  },
];

let failures = 0;

console.log("\nAnalysis V2 Prompt Regression Tests\n");

for (const rule of requiredRules) {
  try {
    assert.ok(
      prompt.includes(rule.text),
      `Missing prompt rule: ${rule.text}`
    );
    console.log(`✅ PASS — ${rule.name}`);
  } catch (error) {
    failures += 1;
    console.error(`❌ FAIL — ${rule.name}`);
    console.error(
      error instanceof Error ? error.message : String(error)
    );
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log("\nResult: all Analysis V2 prompt tests passed.");
}
