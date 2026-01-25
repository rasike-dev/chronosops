import { Controller, Get } from "@nestjs/common";
import { Public } from "../../auth/public.decorator";

@Controller("v1/health")
export class HealthController {
  @Public()
  @Get()
  getHealth() {
    return { ok: true, service: "chronosops-api", time: new Date().toISOString() };
  }
}
