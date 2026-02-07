-- AlterTable
ALTER TABLE "IncidentAnalysis" ADD COLUMN     "evidenceBundleId" TEXT;

-- CreateTable
CREATE TABLE "EvidenceBundle" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "sources" TEXT[],
    "payload" JSONB NOT NULL,
    "hashAlgo" TEXT NOT NULL,
    "hashInputVersion" TEXT NOT NULL,

    CONSTRAINT "EvidenceBundle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceBundle_bundleId_key" ON "EvidenceBundle"("bundleId");

-- CreateIndex
CREATE INDEX "EvidenceBundle_incidentId_idx" ON "EvidenceBundle"("incidentId");

-- CreateIndex
CREATE INDEX "EvidenceBundle_createdAt_idx" ON "EvidenceBundle"("createdAt");

-- CreateIndex
CREATE INDEX "IncidentAnalysis_evidenceBundleId_idx" ON "IncidentAnalysis"("evidenceBundleId");

-- AddForeignKey
ALTER TABLE "IncidentAnalysis" ADD CONSTRAINT "IncidentAnalysis_evidenceBundleId_fkey" FOREIGN KEY ("evidenceBundleId") REFERENCES "EvidenceBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceBundle" ADD CONSTRAINT "EvidenceBundle_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
