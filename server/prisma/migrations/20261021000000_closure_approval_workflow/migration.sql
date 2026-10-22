CREATE TYPE "ClosureType" AS ENUM ('Settlement', 'Closure');
CREATE TYPE "ApprovalStage" AS ENUM ('Manager', 'Head');

ALTER TABLE "SettlementOffer"
ADD COLUMN "type" "ClosureType" NOT NULL DEFAULT 'Settlement',
ADD COLUMN "stage" "ApprovalStage" NOT NULL DEFAULT 'Manager',
ADD COLUMN "managerReviewedById" TEXT,
ADD COLUMN "managerReviewedAt" TIMESTAMP(3);

ALTER TABLE "SettlementOffer" ADD CONSTRAINT "SettlementOffer_managerReviewedById_fkey"
FOREIGN KEY ("managerReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
