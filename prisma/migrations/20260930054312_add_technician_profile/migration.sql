/*
  Warnings:

  - You are about to drop the column `organizationId` on the `TechnicianProfile` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `TechnicianProfile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[membershipId]` on the table `TechnicianProfile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `membershipId` to the `TechnicianProfile` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "TechnicianProfile" DROP CONSTRAINT "TechnicianProfile_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "TechnicianProfile" DROP CONSTRAINT "TechnicianProfile_userId_fkey";

-- DropIndex
DROP INDEX "TechnicianProfile_organizationId_employeeId_key";

-- DropIndex
DROP INDEX "TechnicianProfile_organizationId_idx";

-- DropIndex
DROP INDEX "TechnicianProfile_userId_key";

-- DropIndex
DROP INDEX "TechnicianProfile_userId_organizationId_key";

-- AlterTable
ALTER TABLE "TechnicianProfile" DROP COLUMN "organizationId",
DROP COLUMN "userId",
ADD COLUMN     "membershipId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianProfile_membershipId_key" ON "TechnicianProfile"("membershipId");

-- CreateIndex
CREATE INDEX "TechnicianProfile_employeeId_idx" ON "TechnicianProfile"("employeeId");

-- AddForeignKey
ALTER TABLE "TechnicianProfile" ADD CONSTRAINT "TechnicianProfile_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
