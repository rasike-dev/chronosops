import { Controller, Get } from "@nestjs/common";
import { Public } from "../../auth/public.decorator";
import { VersionService } from "./version.service";

@Controller("v1/version")
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Public()
  @Get()
  getVersion() {
    return this.versionService.getVersion();
  }
}
