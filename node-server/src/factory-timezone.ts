import * as dotenv from 'dotenv';

// Imported first by main.ts so the zone is set before any module computes a date.
// Calendar days and shift windows are factory-local; never depend on the host zone.
dotenv.config();
process.env.TZ = process.env.MES_TIMEZONE || 'Asia/Dhaka';
