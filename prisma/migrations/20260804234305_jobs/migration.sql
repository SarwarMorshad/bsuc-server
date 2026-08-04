-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayUnit" AS ENUM ('HOUR', 'MONTH');

-- CreateEnum
CREATE TYPE "GermanLevel" AS ENUM ('ENGLISH_OK', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- DropIndex
DROP INDEX "jobs_published_createdAt_idx";

-- AlterTable
ALTER TABLE "jobs" DROP COLUMN "description",
DROP COLUMN "published",
ADD COLUMN     "aboutCompany" TEXT NOT NULL,
ADD COLUMN     "applyEmail" TEXT,
ADD COLUMN     "companyWebsite" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "germanLevel" "GermanLevel",
ADD COLUMN     "hoursPerWeek" INTEGER,
ADD COLUMN     "offer" TEXT,
ADD COLUMN     "payCents" INTEGER,
ADD COLUMN     "payNote" TEXT,
ADD COLUMN     "payUnit" "PayUnit" NOT NULL DEFAULT 'HOUR',
ADD COLUMN     "profile" TEXT NOT NULL,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "remote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "submitterEmail" TEXT NOT NULL,
ADD COLUMN     "submitterName" TEXT NOT NULL,
ADD COLUMN     "submitterPhone" TEXT,
ADD COLUMN     "tasks" TEXT NOT NULL,
ADD COLUMN     "until" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "jobs_status_createdAt_idx" ON "jobs"("status", "createdAt");

