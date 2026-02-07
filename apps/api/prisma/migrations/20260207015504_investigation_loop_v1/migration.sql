-- CreateTable
CREATE TABLE "InvestigationSession" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "maxIterations" INTEGER NOT NULL,
    "confidenceTarget" DOUBLE PRECISION NOT NULL,
    "currentIteration" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvestigationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationIteration" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "iteration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceBundleId" TEXT,
    "analysisId" TEXT,
    "completenessScore" INTEGER,
    "overallConfidence" DOUBLE PRECISION,
    "decisionJson" JSONB,
    "notes" TEXT,

    CONSTRAINT "InvestigationIteration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvestigationSession_incidentId_idx" ON "InvestigationSession"("incidentId");

-- CreateIndex
CREATE INDEX "InvestigationSession_createdAt_idx" ON "InvestigationSession"("createdAt");

-- CreateIndex
CREATE INDEX "InvestigationIteration_sessionId_idx" ON "InvestigationIteration"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestigationIteration_sessionId_iteration_key" ON "InvestigationIteration"("sessionId", "iteration");

-- AddForeignKey
ALTER TABLE "InvestigationSession" ADD CONSTRAINT "InvestigationSession_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationIteration" ADD CONSTRAINT "InvestigationIteration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InvestigationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
