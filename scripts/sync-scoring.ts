import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const projectRoot = process.cwd();

const sourcePath = path.join(
  projectRoot,
  "app/results/page.tsx",
);

const targetPaths = [
  path.join(projectRoot, "engine/scoring.ts"),
  path.join(projectRoot, "app/results/engine/scoring.ts"),
];

/**
 * These declarations become named exports in generated mirrors.
 *
 * ScoreData is exported for type safety.
 * The other five functions are used by the regression harness.
 */
const publicRoots = [
  "ScoreData",
  "analyzeScript",
  "detectScriptStructures",
  "detectNarrativeArc",
  "createScriptLines",
  "estimateDuration",
] as const;

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Source file does not exist: ${sourcePath}`);
}

const sourceText = fs.readFileSync(sourcePath, "utf8");

const sourceFile = ts.createSourceFile(
  sourcePath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

const declarationByName = new Map<string, ts.Statement>();
const importByName = new Map<string, ts.ImportDeclaration>();

function registerDeclaration(
  name: string | undefined,
  statement: ts.Statement,
): void {
  if (!name) return;

  const existing = declarationByName.get(name);

  if (existing && existing !== statement) {
    throw new Error(
      `Multiple top-level declarations named "${name}" were found. ` +
        "The sync script refuses to guess which one should be used.",
    );
  }

  declarationByName.set(name, statement);
}

function registerBindingName(
  name: ts.BindingName,
  statement: ts.Statement,
): void {
  if (ts.isIdentifier(name)) {
    registerDeclaration(name.text, statement);
    return;
  }

  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) {
      registerBindingName(element.name, statement);
    }
  }
}

for (const statement of sourceFile.statements) {
  if (ts.isImportDeclaration(statement)) {
    const importClause = statement.importClause;

    if (!importClause) continue;

    if (importClause.name) {
      importByName.set(importClause.name.text, statement);
    }

    const bindings = importClause.namedBindings;

    if (bindings && ts.isNamespaceImport(bindings)) {
      importByName.set(bindings.name.text, statement);
    }

    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        importByName.set(element.name.text, statement);
      }
    }

    continue;
  }

  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement)
  ) {
    registerDeclaration(statement.name?.text, statement);
    continue;
  }

  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      registerBindingName(declaration.name, statement);
    }
  }
}

const missingRoots = publicRoots.filter(
  (name) => !declarationByName.has(name),
);

if (missingRoots.length > 0) {
  throw new Error(
    [
      "The following required top-level declarations were not found:",
      ...missingRoots.map((name) => `  - ${name}`),
      "",
      "Nothing was overwritten.",
      "Check whether any function was renamed or moved inside a component.",
    ].join("\n"),
  );
}

function isDeclarationIdentifier(identifier: ts.Identifier): boolean {
  const parent = identifier.parent;

  if (
    (
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isClassExpression(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isEnumDeclaration(parent) ||
      ts.isModuleDeclaration(parent) ||
      ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isTypeParameterDeclaration(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent) ||
      ts.isEnumMember(parent)
    ) &&
    parent.name === identifier
  ) {
    return true;
  }

  if (
    ts.isBindingElement(parent) &&
    (parent.name === identifier || parent.propertyName === identifier)
  ) {
    return true;
  }

  if (
    ts.isPropertyAccessExpression(parent) &&
    parent.name === identifier
  ) {
    return true;
  }

  if (
    ts.isPropertyAssignment(parent) &&
    parent.name === identifier
  ) {
    return true;
  }

  if (
    ts.isQualifiedName(parent) &&
    parent.right === identifier
  ) {
    return true;
  }

  if (
    ts.isLabeledStatement(parent) &&
    parent.label === identifier
  ) {
    return true;
  }

  if (
    (ts.isBreakStatement(parent) ||
      ts.isContinueStatement(parent)) &&
    parent.label === identifier
  ) {
    return true;
  }

  if (
    ts.isImportSpecifier(parent) ||
    ts.isImportClause(parent) ||
    ts.isNamespaceImport(parent) ||
    ts.isExportSpecifier(parent)
  ) {
    return true;
  }

  return false;
}

function collectReferencedIdentifiers(
  node: ts.Node,
  result: Set<string>,
): void {
  if (ts.isIdentifier(node) && !isDeclarationIdentifier(node)) {
    result.add(node.text);
  }

  ts.forEachChild(node, (child) => {
    collectReferencedIdentifiers(child, result);
  });
}

function containsJsx(node: ts.Node): boolean {
  let found = false;

  function visit(current: ts.Node): void {
    if (found) return;

    if (
      ts.isJsxElement(current) ||
      ts.isJsxSelfClosingElement(current) ||
      ts.isJsxFragment(current)
    ) {
      found = true;
      return;
    }

    ts.forEachChild(current, visit);
  }

  visit(node);
  return found;
}

const selectedStatements = new Set<ts.Statement>();
const referencedImports = new Set<ts.ImportDeclaration>();
const visitedNames = new Set<string>();
const queue: string[] = [...publicRoots];

while (queue.length > 0) {
  const currentName = queue.shift();

  if (!currentName || visitedNames.has(currentName)) {
    continue;
  }

  visitedNames.add(currentName);

  const declaration = declarationByName.get(currentName);

  if (declaration) {
    if (!selectedStatements.has(declaration)) {
      selectedStatements.add(declaration);

      const references = new Set<string>();
      collectReferencedIdentifiers(declaration, references);

      for (const reference of references) {
        if (
          declarationByName.has(reference) ||
          importByName.has(reference)
        ) {
          queue.push(reference);
        }
      }
    }

    continue;
  }

  const importDeclaration = importByName.get(currentName);

  if (importDeclaration) {
    referencedImports.add(importDeclaration);
  }
}

/**
 * The generated scoring mirror must remain standalone and UI-free.
 * Any imported dependency requires an explicit review instead of silently
 * copying React, Lucide or another page dependency.
 */
if (referencedImports.size > 0) {
  const modules = [...referencedImports].map((statement) => {
    const moduleSpecifier = statement.moduleSpecifier;

    return ts.isStringLiteral(moduleSpecifier)
      ? moduleSpecifier.text
      : moduleSpecifier.getText(sourceFile);
  });

  throw new Error(
    [
      "Pure scoring declarations unexpectedly depend on imports:",
      ...modules.map((moduleName) => `  - ${moduleName}`),
      "",
      "Nothing was overwritten.",
      "Move that dependency into pure local scoring code or review it explicitly.",
    ].join("\n"),
  );
}

for (const statement of selectedStatements) {
  if (containsJsx(statement)) {
    const names = [...declarationByName.entries()]
      .filter(([, candidate]) => candidate === statement)
      .map(([name]) => name);

    throw new Error(
      [
        `JSX was found in a selected declaration: ${names.join(", ")}`,
        "Nothing was overwritten.",
        "A pure scoring function is depending on UI code.",
      ].join("\n"),
    );
  }
}

const publicStatements = new Set<ts.Statement>();

for (const root of publicRoots) {
  const statement = declarationByName.get(root);

  if (statement) {
    publicStatements.add(statement);
  }
}

function ensureNamedExport(
  statement: ts.Statement,
  text: string,
): string {
  const modifiers = (
    statement as ts.Statement & {
      modifiers?: ts.NodeArray<ts.ModifierLike>;
    }
  ).modifiers;

  const hasExport = modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );

  const hasDefault = modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
  );

  if (hasDefault) {
    return text.replace(
      /^\s*export\s+default\s+/,
      "export ",
    );
  }

  if (hasExport) {
    return text;
  }

  return `export ${text}`;
}

const scoreDataStatement = declarationByName.get("ScoreData");

const orderedStatements = [...selectedStatements].sort(
  (a, b) => a.getStart(sourceFile) - b.getStart(sourceFile),
);

/**
 * Put the public ScoreData type first. The remaining runtime declarations
 * retain their original relative order.
 */
if (scoreDataStatement) {
  const index = orderedStatements.indexOf(scoreDataStatement);

  if (index > 0) {
    orderedStatements.splice(index, 1);
    orderedStatements.unshift(scoreDataStatement);
  }
}

const generatedParts = orderedStatements.map((statement) => {
  const originalText = sourceText.slice(
    statement.getStart(sourceFile),
    statement.getEnd(),
  );

  return publicStatements.has(statement)
    ? ensureNamedExport(statement, originalText)
    : originalText;
});

const output = [
  "// AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.",
  "// Source: app/results/page.tsx",
  "// Regenerate with: npx tsx scripts/sync-scoring.ts",
  "",
  ...generatedParts.flatMap((part) => [part, ""]),
].join("\n");

const forbiddenPatterns: Array<{
  pattern: RegExp;
  message: string;
}> = [
  {
    pattern: /["']use client["']/,
    message: '"use client" directive',
  },
  {
    pattern: /\bfrom\s+["']react["']/,
    message: "React import",
  },
  {
    pattern: /\bfrom\s+["']lucide-react["']/,
    message: "Lucide React import",
  },
  {
    pattern: /\bclassName\s*=/,
    message: "JSX className attribute",
  },
];

for (const check of forbiddenPatterns) {
  if (check.pattern.test(output)) {
    throw new Error(
      `Generated output contains forbidden UI code: ${check.message}`,
    );
  }
}

const transpileResult = ts.transpileModule(output, {
  fileName: "scoring.ts",
  reportDiagnostics: true,
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    strict: true,
  },
});

const syntaxErrors = (transpileResult.diagnostics ?? []).filter(
  (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
);

if (syntaxErrors.length > 0) {
  const host: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => projectRoot,
    getNewLine: () => "\n",
  };

  throw new Error(
    [
      "Generated scoring mirror has TypeScript syntax errors.",
      "Nothing was overwritten.",
      "",
      ts.formatDiagnosticsWithColorAndContext(
        syntaxErrors,
        host,
      ),
    ].join("\n"),
  );
}

for (const targetPath of targetPaths) {
  fs.mkdirSync(path.dirname(targetPath), {
    recursive: true,
  });

  const temporaryPath = `${targetPath}.tmp`;

  fs.writeFileSync(temporaryPath, output, "utf8");
  fs.renameSync(temporaryPath, targetPath);

  console.log(
    `Synced ${path.relative(projectRoot, targetPath)}`,
  );
}

const includedNames = [...declarationByName.entries()]
  .filter(([, statement]) => selectedStatements.has(statement))
  .map(([name]) => name)
  .sort();

console.log("");
console.log("Included declarations:");
for (const name of includedNames) {
  console.log(`  - ${name}`);
}
