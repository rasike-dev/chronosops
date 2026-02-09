-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "versionFrom" TEXT NOT NULL,
    "versionTo" TEXT NOT NULL,
    "deploymentTimestamp" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "tags" TEXT[],
    "category" TEXT,
    "severity" TEXT,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scenario_scenarioId_key" ON "Scenario"("scenarioId");

-- CreateIndex
CREATE INDEX "Scenario_scenarioId_idx" ON "Scenario"("scenarioId");

-- CreateIndex
CREATE INDEX "Scenario_category_idx" ON "Scenario"("category");

-- CreateIndex
CREATE INDEX "Scenario_createdAt_idx" ON "Scenario"("createdAt");
