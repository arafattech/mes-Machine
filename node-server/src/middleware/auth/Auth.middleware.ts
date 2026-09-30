import { Injectable, NestMiddleware } from "@nestjs/common";
import { PrismaService } from "@prisma/prisma.service";
import { serializeBigInt } from "config/lib/BigIntPerser";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class AuthMiddleWare implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (process.env.AUTHENTICATION_FROM_NODE !== "true") return next();

    const authHeader = Array.isArray(req.headers["authorization"])
      ? req.headers["authorization"][0]
      : req.headers["authorization"];

    const token =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;

    if (!token) return res.status(401).json({ success: false, message: "Missing authentication token" });

    try {
      const user = await this.prisma.users.findFirst({ where: { remember_token: token , is_active:true}, select:{
        name: true , phone:true , remember_token:true , id:true , created_at:true, updated_at: true , email:true
      } });
      if (!user) return res.status(401).json({ success: false, message: "Invalid or expired token" });
      (req as any).authInfo =serializeBigInt(user);
      next();
    } catch {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
  }
}
