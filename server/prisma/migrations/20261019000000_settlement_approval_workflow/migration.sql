CREATE TYPE "SettlementStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

CREATE TABLE "SettlementOffer" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'Pending',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SettlementOffer_accountId_status_idx" ON "SettlementOffer"("accountId", "status");

ALTER TABLE "SettlementOffer" ADD CONSTRAINT "SettlementOffer_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("loanNo") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SettlementOffer" ADD CONSTRAINT "SettlementOffer_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SettlementOffer" ADD CONSTRAINT "SettlementOffer_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
