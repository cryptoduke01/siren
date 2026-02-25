/**
 * Seed tag library into DB (optional - for market-tag mappings).
 * Run: pnpm db:seed
 */
import { PrismaClient } from "@prisma/client";
import { TAG_LIBRARY } from "@siren/shared";

const prisma = new PrismaClient();

async function main() {
  // Tag library is in code; we could persist market→tag mappings here
  console.log("Tag library:", TAG_LIBRARY.length, "categories");
  console.log("Done. Tag library lives in @siren/shared.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
