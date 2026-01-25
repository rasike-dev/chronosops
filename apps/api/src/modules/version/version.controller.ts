import { Controller, Get } from "@nestjs/common";
import { Public } from "../../auth/public.decorator";

@Controller("v1/version")
export class VersionController {
  @Public()
  @Get()
  getVersion() {
    return {
      service: "chronosops-api",
      version: "0.0.1",
      time: new Date().toISOString(),
    };
  }
}
