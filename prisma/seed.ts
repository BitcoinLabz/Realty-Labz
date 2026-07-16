import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // IRS standard mileage rate, confirmed by the user. Real estate agents deduct mileage
  // using this federal rate; Michigan does not set its own separate rate.
  await prisma.mileageRate.upsert({
    where: { state_year: { state: "MI", year: 2026 } },
    update: { ratePerMile: 0.725 },
    create: { state: "MI", year: 2026, ratePerMile: 0.725 },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
