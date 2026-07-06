// Visual detail rewrite strategy for deterministic hook rewrites.
// Keep hook rewrite orchestration itself in scoring-rewrite.ts.

import { capitalizeFirst } from "./scoring-rewrite-formatting";

export function createVisualDetailRewrite(bodyLines: string[]): string | null {
  const visualDetailLine = bodyLines.find(line => {
    const ll = line.toLowerCase();
    const wc = line.split(/\s+/).length;
    return wc >= 5 && wc <= 22 && (
      // observable state (universal: any subject can be "still there")
      /\bstill\b/.test(ll) ||
      // absence / presence markers (universal)
      /\bleft behind\b|\buntouched\b|\bno signs of\b/.test(ll) ||
      // disappearance / discovery (universal)
      /\bdisappeared\b|\bvanished\b|\bfound\b|\bdiscovered\b/.test(ll) ||
      // specific named objects in context (universal — any physical object detail)
      (ll.includes("on the") && /\b(table|floor|ground|deck|shelf|wall|seat)\b/.test(ll)) ||
      // nobody / absence of people (universal)
      /\bnobody\b|\bno one\b|\bevery person\b|\beveryone (was gone|had left|disappeared)\b/.test(ll)
    );
  });

  if (!visualDetailLine) return null;

  const cleaned = visualDetailLine.replace(/[.!?]+$/, "").trim();
  const words = cleaned.split(/\s+/);
  const hook = words.length <= 18
    ? capitalizeFirst(cleaned)
    : capitalizeFirst(words.slice(0, 14).join(" "));

  // Find a complementary second detail (any absence or contrast line)
  const secondDetail = bodyLines.find(line => {
    const ll = line.toLowerCase();
    return line !== visualDetailLine &&
      (ll.includes("but") || ll.includes("yet") || ll.includes("gone") ||
       ll.includes("missing") || ll.includes("nobody") || ll.includes("no one")) &&
      line.split(/\s+/).length >= 4 && line.split(/\s+/).length <= 14;
  });

  if (secondDetail) {
    const secondCleaned = secondDetail.replace(/[.!?]+$/, "").trim().toLowerCase();
    const secondWords = secondCleaned.split(/\s+/).slice(0, 8).join(" ");
    return `${hook} — ${secondWords}.`;
  }
  return `${hook} — and nobody knew why.`;
}
