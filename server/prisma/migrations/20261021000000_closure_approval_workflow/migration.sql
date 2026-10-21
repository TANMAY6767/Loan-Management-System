CREATE TYPE "ClosureType" AS ENUM ('Settlement', 'Closure');

ALTER TABLE "SettlementOffer"
ADD COLUMN "type" "ClosureType" NOT NULL DEFAULT 'Settlement';
