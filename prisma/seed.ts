import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const sqliteUrl = process.env.DATABASE_URL;
if (!sqliteUrl) throw new Error("DATABASE_URL is not configured");

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: sqliteUrl }),
});

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Password123!";
  const passwordHash = await hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      firstName: "System",
      lastName: "Administrator",
      email: "admin@accesspilot.com",
      role: "admin",
      passwordHash,
    },
    create: {
      firstName: "System",
      lastName: "Administrator",
      email: "admin@accesspilot.com",
      username: "admin",
      role: "admin",
      passwordHash,
    },
  });

  console.log("Admin user ready: admin");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });