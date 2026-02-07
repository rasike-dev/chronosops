-- CreateTable
CREATE TABLE "PromptTrace" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "evidenceBundleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseHash" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userPrompt" TEXT NOT NULL,
    "requestJson" JSONB NOT NULL,
    "responseJson" JSONB NOT NULL,

    CONSTRAINT "PromptTrace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptTrace_incidentId_idx" ON "PromptTrace"("incidentId");

-- CreateIndex
CREATE INDEX "PromptTrace_analysisId_idx" ON "PromptTrace"("analysisId");

-- CreateIndex
CREATE INDEX "PromptTrace_evidenceBundleId_idx" ON "PromptTrace"("evidenceBundleId");

-- CreateIndex
CREATE INDEX "PromptTrace_createdAt_idx" ON "PromptTrace"("createdAt");

-- AddForeignKey
ALTER TABLE "PromptTrace" ADD CONSTRAINT "PromptTrace_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptTrace" ADD CONSTRAINT "PromptTrace_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "IncidentAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
