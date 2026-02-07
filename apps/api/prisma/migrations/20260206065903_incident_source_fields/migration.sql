-- CreateEnum
CREATE TYPE "IncidentSourceType" AS ENUM ('SCENARIO', 'GOOGLE_CLOUD');

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "sourcePayload" JSONB,
ADD COLUMN     "sourceRef" TEXT,
ADD COLUMN     "sourceType" "IncidentSourceType" NOT NULL DEFAULT 'SCENARIO';

-- CreateIndex
CREATE INDEX "Incident_sourceType_idx" ON "Incident"("sourceType");

-- CreateIndex
CREATE INDEX "Incident_sourceRef_idx" ON "Incident"("sourceRef");
