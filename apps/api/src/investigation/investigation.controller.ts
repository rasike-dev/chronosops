import { Controller, Get, HttpException, HttpStatus, Param } from "@nestjs/common";
import { InvestigationService } from "./investigation.service";
import { InvestigationStatusSchema } from "@chronosops/contracts";
import { Roles } from "../auth/roles.decorator";

@Controller("v1/investigations")
export class InvestigationController {
  constructor(private readonly investigationService: InvestigationService) {}

  @Roles('CHRONOSOPS_VIEWER', 'CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Get(":sessionId")
  async getSessionStatus(@Param('sessionId') sessionId: string) {
    try {
      const status = await this.investigationService.getSessionStatus(sessionId);
      return InvestigationStatusSchema.parse(status);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[InvestigationController.getSessionStatus] Error:', error?.message || error);
      throw new HttpException(
        `Failed to get investigation status: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
