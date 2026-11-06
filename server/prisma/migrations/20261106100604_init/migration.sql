-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('AVAILABLE', 'ON_DELIVERY', 'INACTIVE');

-- CreateTable
CREATE TABLE "DeliveryAgent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAgent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAgent_email_key" ON "DeliveryAgent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAgent_phone_key" ON "DeliveryAgent"("phone");
