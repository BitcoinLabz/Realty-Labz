import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // NOTE: verify this against the current IRS standard mileage rate before relying on it —
  // placeholder uses the last confirmed rate as of this seed's authoring. Real estate agents
  // deduct mileage using the federal IRS rate; Michigan does not set its own separate rate.
  await prisma.mileageRate.upsert({
    where: { state_year: { state: "MI", year: 2026 } },
    update: {},
    create: { state: "MI", year: 2026, ratePerMile: 0.70 },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
