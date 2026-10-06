import { checkRefutation } from "../lib/refute";
import { CASES } from "../lib/catalog";
import { validateCatalog } from "../lib/catalog/validate";

for (const c of CASES) {
  const kind = c.bug ? `${c.bug.refute.mode}, demo ${c.bug.demo.length}, decoy ${c.bug.decoy.length}` : "clean";
  const demoOk = c.bug ? c.bug.demo.every((d) => checkRefutation(c.bug!.refute, d).ok) : true;
  console.log(`${demoOk ? "ok  " : "FAIL"} ${c.id.padEnd(8)} level ${String(c.level).padEnd(3)}${c.type_id.padEnd(18)} ${kind}`);
}

const errors = validateCatalog(CASES);
if (errors.length > 0) {
  console.error(`\nCatalog verification failed (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`\nCatalog OK: ${CASES.length} cases, ${CASES.filter((c) => c.bug === null).length} clean.`);
