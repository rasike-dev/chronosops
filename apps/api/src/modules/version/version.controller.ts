import { Controller, Get } from "@nestjs/common";

@Controller("v1/version")
export class VersionController {
  @Get()
  getVersion() {
    return {
      service: "chronosops-api",
      version: "0.0.1",
      time: new Date().toISOString(),
    };
  }
}
