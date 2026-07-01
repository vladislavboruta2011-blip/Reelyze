export function createDisplayFixes(
  fixes: string[],
  aiHook: string
): string[] {
  return fixes.map((fix) => {
    if (aiHook && fix.toLowerCase().startsWith("rewrite your hook:")) {
      return `Rewrite your hook: "${aiHook}"`;
    }

    return fix;
  });
}
