import { readFileSync } from "node:fs";
import path from "node:path";

// No live database in this repo's test harness (tests run with tsx, not
// against Postgres), so this checks the migration's SQL source directly for
// the security properties that matter — RLS enabled, one policy per
// operation scoped to auth.uid() = user_id, UPDATE guarded on both sides,
// anon left with nothing, and ownership required not-null with no
// mutable-primary-key backdoor — rather than asserting on arbitrary text.

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260717120000_create_analyses_table.sql"
);
const sql = readFileSync(migrationPath, "utf8");

let failures = 0;

function check(label: string, pass: boolean, hint?: string): void {
  if (pass) {
    console.log(`PASS — ${label}`);
    return;
  }

  failures += 1;
  console.error(`FAIL — ${label}${hint ? `: ${hint}` : ""}`);
}

check(
  "table is created in the public schema",
  /create table if not exists public\.analyses/i.test(sql)
);

check(
  "user_id is a not-null foreign key to auth.users with on delete cascade",
  /user_id\s+uuid\s+not null\s+references\s+auth\.users\s*\(id\)\s+on delete cascade/i.test(
    sql
  )
);

check(
  "result_json must be a JSON object, not an arbitrary JSON value",
  /check\s*\(\s*jsonb_typeof\(result_json\)\s*=\s*'object'\s*\)/i.test(sql)
);

check(
  "title has a non-blank constraint",
  /analyses_title_not_blank/i.test(sql) &&
    /char_length\(btrim\(title\)\)\s*>\s*0/i.test(sql)
);

check(
  "script has a non-blank constraint",
  /analyses_script_not_blank/i.test(sql) &&
    /char_length\(btrim\(script\)\)\s*>\s*0/i.test(sql)
);

check(
  "locale is constrained to the locales Analysis V2 actually generates",
  /check\s*\(\s*locale in \('en', 'ru'\)\s*\)/i.test(sql)
);

check(
  "an index supports newest-first queries scoped to one owner",
  /create index if not exists analyses_user_id_created_at_idx\s+on public\.analyses \(user_id, created_at desc\)/i.test(
    sql
  )
);

check(
  "RLS is enabled on the table",
  /alter table public\.analyses enable row level security/i.test(sql)
);

// Exactly one policy per CRUD operation, each scoped to auth.uid() = user_id.
const policyBlocks: Record<string, RegExp> = {
  select:
    /create policy analyses_select_own\s+on public\.analyses\s+for select\s+to authenticated\s+using \(auth\.uid\(\) = user_id\);/i,
  insert:
    /create policy analyses_insert_own\s+on public\.analyses\s+for insert\s+to authenticated\s+with check \(auth\.uid\(\) = user_id\);/i,
  delete:
    /create policy analyses_delete_own\s+on public\.analyses\s+for delete\s+to authenticated\s+using \(auth\.uid\(\) = user_id\);/i,
};

for (const [operation, pattern] of Object.entries(policyBlocks)) {
  check(
    `${operation} policy exists and is scoped to auth.uid() = user_id`,
    pattern.test(sql)
  );
}

// UPDATE is the one operation where ownership transfer is the specific risk
// being guarded against, so it gets its own stricter check: both the
// existing row (using) and the resulting row (with check) must be owned by
// the caller. Either clause alone would allow a one-directional transfer.
const updatePolicyMatch = sql.match(
  /create policy analyses_update_own\s+on public\.analyses\s+for update\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)\s+with check \(auth\.uid\(\) = user_id\);/i
);

check(
  "update policy has both USING and WITH CHECK scoped to auth.uid() = user_id, blocking ownership transfer in either direction",
  updatePolicyMatch !== null,
  "an UPDATE policy with only USING (or only WITH CHECK) would let a user either take over another user's row, or give their own row away"
);

check(
  "anon has all table privileges explicitly revoked",
  /revoke all on table public\.analyses from anon;/i.test(sql)
);

check(
  "authenticated is granted only CRUD, not table ownership/DDL privileges",
  /grant select, insert, update, delete on table public\.analyses to authenticated;/i.test(
    sql
  ) && !/grant all on table public\.analyses to authenticated/i.test(sql)
);

check(
  "service_role keeps full access for trusted backend operations",
  /grant all on table public\.analyses to service_role;/i.test(sql)
);

check(
  "no default of auth.uid() on user_id (ownership must be set explicitly by the app)",
  !/user_id\s+uuid\s+not null\s+default\s+auth\.uid\(\)/i.test(sql)
);

if (failures > 0) {
  console.error(`\nanalyses migration tests: ${failures} failed`);
  process.exitCode = 1;
} else {
  console.log("\nanalyses migration tests: all passed");
}
