ALTER TABLE "Allocation"
ADD CONSTRAINT "Allocation_allocatedBy_fkey"
FOREIGN KEY ("allocatedBy") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Allocation"
ADD CONSTRAINT "Allocation_fromUserId_fkey"
FOREIGN KEY ("fromUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
