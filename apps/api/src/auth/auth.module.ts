import { Module } from '@nestjs/common'
import { PassportModule } from '@nestjs/passport'
import { JwtStrategy } from './jwt.strategy'
import { AuthController } from './auth.controller'
import { UsersController } from './users.controller'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), PrismaModule],
  controllers: [AuthController, UsersController],
  providers: [JwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
