import { Module } from "@nestjs/common";
import { GoogleIncidentsClient } from "./google.client";
import { GoogleIncidentNormalizer } from "./google.normalizer";
import { GoogleIntegrationService } from "./google.service";

@Module({
  providers: [GoogleIncidentsClient, GoogleIncidentNormalizer, GoogleIntegrationService],
  exports: [GoogleIntegrationService],
})
export class GoogleIntegrationModule {}
