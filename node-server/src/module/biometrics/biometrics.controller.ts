import { Controller, Get } from "@nestjs/common";
import { BiometricsService } from "./biometrics.service";

@Controller()
export class BiometricsController {
  constructor(private readonly biometricsService: BiometricsService) {}

  @Get()
  getHello() {
    return { message: "Biometrics works" };
  }

}
