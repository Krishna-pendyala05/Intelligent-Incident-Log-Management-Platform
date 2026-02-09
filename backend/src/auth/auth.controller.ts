import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login to get JWT token' })
  @ApiResponse({ status: 200, description: 'Return access token.' })
  @HttpCode(HttpStatus.OK)
  async login(@Body() signInDto: LoginDto) {
    const user = await this.authService.validateUser(signInDto.email, signInDto.password);
    if (!user) {
      throw new Promise((_, reject) => reject(new Error('Unauthorized')));
    }
    return this.authService.login(user);
  }
}
