import { Controller, Get } from "@nestjs/common";

@Controller("v1/health")
export class HealthController {
  @Get()
  getHealth() {
    return { ok: true, service: "chronosops-api", time: new Date().toISOString() };
  }
}
