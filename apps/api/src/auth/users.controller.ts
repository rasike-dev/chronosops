import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Roles } from "./roles.decorator";

@Controller("v1/users")
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles('CHRONOSOPS_ADMIN')
  @Get("activity")
  async getUsersActivity() {
    try {
      // Get unique users from evidence bundles
      const evidenceBundleUsers = await this.prisma.evidenceBundle.findMany({
        where: { createdBy: { not: null } },
        select: { createdBy: true },
        distinct: ['createdBy'],
      });

      // Get unique users from investigation sessions
      const investigationUsers = await this.prisma.investigationSession.findMany({
        where: { createdBy: { not: null } },
        select: { createdBy: true },
        distinct: ['createdBy'],
      });

      // Combine and get unique user IDs
      const allUserIds = new Set<string>();
      evidenceBundleUsers.forEach((u) => {
        if (u.createdBy) allUserIds.add(u.createdBy);
      });
      investigationUsers.forEach((u) => {
        if (u.createdBy) allUserIds.add(u.createdBy);
      });

      // Get activity counts per user
      const users = Array.from(allUserIds).map((userId) => {
        return {
          userId,
          evidenceBundlesCreated: 0,
          investigationSessionsCreated: 0,
          totalActivity: 0,
        };
      });

      // Count activities
      for (const user of users) {
        const bundleCount = await this.prisma.evidenceBundle.count({
          where: { createdBy: user.userId },
        });
        const sessionCount = await this.prisma.investigationSession.count({
          where: { createdBy: user.userId },
        });

        user.evidenceBundlesCreated = bundleCount;
        user.investigationSessionsCreated = sessionCount;
        user.totalActivity = bundleCount + sessionCount;
      }

      // Sort by total activity
      users.sort((a, b) => b.totalActivity - a.totalActivity);

      return {
        totalUsers: users.length,
        users,
        summary: {
          totalEvidenceBundles: await this.prisma.evidenceBundle.count({ where: { createdBy: { not: null } } }),
          totalInvestigationSessions: await this.prisma.investigationSession.count({ where: { createdBy: { not: null } } }),
        },
      };
    } catch (error: any) {
      console.error('[UsersController.getUsersActivity] Error:', error?.message || error);
      throw new HttpException(
        `Failed to get users activity: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
