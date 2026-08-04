-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'MINIJOB';
ALTER TYPE "JobType" ADD VALUE 'THESIS';
ALTER TYPE "JobType" ADD VALUE 'DUAL_STUDY';
ALTER TYPE "JobType" ADD VALUE 'ENTRY_LEVEL';
ALTER TYPE "JobType" ADD VALUE 'TRAINEE';
ALTER TYPE "JobType" ADD VALUE 'FULL_TIME';
ALTER TYPE "JobType" ADD VALUE 'PHD';
ALTER TYPE "JobType" ADD VALUE 'FREELANCE';

