-- CreateEnum
CREATE TYPE "DegreeLevel" AS ENUM ('BACHELOR', 'MASTER', 'PHD', 'OTHER');
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "arrivalYear" INTEGER,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "degreeLevel" "DegreeLevel",
ADD COLUMN     "pendingEmail" TEXT,
ADD COLUMN     "phone" TEXT;
-- AlterTable
ALTER TABLE "verification_tokens" ADD COLUMN     "newEmail" TEXT;
