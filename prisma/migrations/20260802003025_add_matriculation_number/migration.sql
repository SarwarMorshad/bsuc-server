-- AlterTable
ALTER TABLE "users" ADD COLUMN     "matriculationNumber" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_matriculationNumber_key" ON "users"("matriculationNumber");
