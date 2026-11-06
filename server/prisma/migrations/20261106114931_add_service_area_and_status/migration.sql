/*
  Warnings:

  - The values [AVAILABLE,ON_DELIVERY] on the enum `AgentStatus` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `serviceArea` to the `DeliveryAgent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AgentStatus_new" AS ENUM ('ACTIVE', 'INACTIVE');
ALTER TABLE "public"."DeliveryAgent" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DeliveryAgent" ALTER COLUMN "status" TYPE "AgentStatus_new" USING ("status"::text::"AgentStatus_new");
ALTER TYPE "AgentStatus" RENAME TO "AgentStatus_old";
ALTER TYPE "AgentStatus_new" RENAME TO "AgentStatus";
DROP TYPE "public"."AgentStatus_old";
ALTER TABLE "DeliveryAgent" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterTable
ALTER TABLE "DeliveryAgent" ADD COLUMN     "serviceArea" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
