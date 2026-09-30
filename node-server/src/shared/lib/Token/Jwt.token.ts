import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as dotenv from "dotenv";
dotenv.config();

@Injectable()
export class JwtToken {
  private jwtService: JwtService;

  constructor() {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not defined");
    }

    this.jwtService = new JwtService({
      secret,
    });
  }

  generateToken(payload: Record<string, any>): string {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
    });
  }

  async decodeToken(token: string): Promise<Record<string, any>> {
    const decoded = this.jwtService.decode(token) as Record<string, any>;
    return decoded;
  }

  async verifyToken(token: string): Promise<Record<string, any>> {
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      return decoded;
    } catch (error) {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
