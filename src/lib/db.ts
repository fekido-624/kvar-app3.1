import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  sqliteTuned?: boolean;
};

const sqliteUrl = process.env.DATABASE_URL;
if (!sqliteUrl) {
  throw new Error('DATABASE_URL is not configured');
}

const adapter = new PrismaBetterSqlite3({ url: sqliteUrl });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Mod WAL: setiap commit tak lagi buat beberapa fsync. Di NAS (ZFS) ini turunkan kos
// satu commit dari ~100 ms ke ~0.1 ms. journal_mode kekal dalam fail DB; synchronous
// ialah tetapan sambungan (adapter guna satu sambungan sahaja).
// Dilangkau semasa `next build` kerana folder data belum wujud.
if (!globalForPrisma.sqliteTuned && process.env.NEXT_PHASE !== 'phase-production-build') {
  globalForPrisma.sqliteTuned = true;
  void (async () => {
    try {
      await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
      await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL');
    } catch (error) {
      console.error('[db] Gagal tetapkan mod WAL:', error);
    }
  })();
}