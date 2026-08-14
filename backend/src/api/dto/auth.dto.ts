/**
 * Auth request DTOs with runtime validation.
 * Reference: API Spec (DOC-10) auth endpoints.
 */
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterRequestDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  username!: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class LoginRequestDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class RefreshRequestDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  refreshToken!: string;
}

export class ResetPasswordRequestDto {
  @IsString()
  @MinLength(40)
  @MaxLength(256)
  resetToken!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
