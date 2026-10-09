/**
 * Auth request DTOs with runtime validation.
 * Reference: API Spec (DOC-10) auth endpoints.
 */
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Body of POST /users/admin/users. The tenant always comes from the admin's token. */
export class CreateUserRequestDto {
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
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  role_ids?: string[];
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
  @MinLength(10)
  @MaxLength(128)
  newPassword!: string;
}
