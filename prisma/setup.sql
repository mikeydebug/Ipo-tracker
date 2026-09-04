-- IPO Tracker — Database Setup SQL
-- Run this via: psql [YOUR_CONNECTION_STRING] -f prisma/setup.sql

-- Enums
CREATE TYPE "FundingType" AS ENUM ('FULL', 'SHARED');
CREATE TYPE "DealStatus" AS ENUM ('APPLIED', 'NOT_ALLOTTED', 'ALLOTTED', 'SOLD', 'SETTLED');
CREATE TYPE "SharedProfitBasis" AS ENUM ('OWN_SHARE', 'TOTAL_PROFIT');
CREATE TYPE "LedgerEntryType" AS ENUM ('DISBURSEMENT', 'REFUND', 'SETTLEMENT');
CREATE TYPE "Direction" AS ENUM ('TO_FRIEND', 'FROM_FRIEND');

-- Friend table
CREATE TABLE IF NOT EXISTS "Friend" (
    "id"               TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "contact"          TEXT,
    "defaultProfitPct" DECIMAL(5,4) NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Friend_pkey" PRIMARY KEY ("id")
);

-- Deal table
CREATE TABLE IF NOT EXISTS "Deal" (
    "id"                 TEXT NOT NULL,
    "ipoName"            TEXT NOT NULL,
    "applyDate"          TIMESTAMP(3) NOT NULL,
    "listingDate"        TIMESTAMP(3),
    "friendId"           TEXT NOT NULL,
    "fundingType"        "FundingType" NOT NULL,
    "mayankContribution" DECIMAL(14,2) NOT NULL,
    "friendContribution" DECIMAL(14,2) NOT NULL,
    "status"             "DealStatus" NOT NULL DEFAULT 'APPLIED',
    "profitPct"          DECIMAL(5,4),
    "sharedProfitPct"    DECIMAL(5,4),
    "sharedProfitBasis"  "SharedProfitBasis",
    "salePrice"          DECIMAL(14,2),
    "notes"              TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- LedgerEntry table
CREATE TABLE IF NOT EXISTS "LedgerEntry" (
    "id"        TEXT NOT NULL,
    "friendId"  TEXT NOT NULL,
    "dealId"    TEXT NOT NULL,
    "type"      "LedgerEntryType" NOT NULL,
    "amount"    DECIMAL(14,2) NOT NULL,
    "direction" "Direction" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note"      TEXT,
    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "Deal"
    ADD CONSTRAINT "Deal_friendId_fkey"
    FOREIGN KEY ("friendId") REFERENCES "Friend"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_friendId_fkey"
    FOREIGN KEY ("friendId") REFERENCES "Friend"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trigger for updatedAt auto-update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_friend_updated_at
    BEFORE UPDATE ON "Friend"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deal_updated_at
    BEFORE UPDATE ON "Deal"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
