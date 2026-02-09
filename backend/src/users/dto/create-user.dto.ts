import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'The email of the user' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', description: 'The password of the user (min 6 chars)' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'USER', description: 'The role of the user', required: false })
  @IsOptional()
  @IsString()
  role?: string;
}

