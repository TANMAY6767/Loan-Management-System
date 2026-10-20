CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "settlementOfferId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "Notification_accountId_idx" ON "Notification"("accountId");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("loanNo") ON DELETE CASCADE ON UPDATE CASCADE;
