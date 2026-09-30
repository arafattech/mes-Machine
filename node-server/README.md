📦 MES Node Server
NestJS service for the machine runtime (MQTT / API / Modbus channel acquisition), machine and work-order calculation endpoints, employee excel import (BullMQ) and realtime events (Socket.IO), backed by Prisma.

🏢 Project Info
Company: Hybritech Innovation LTD

Author: Shihab

Authentication: Custom implementation (e.g., JWT/OAuth)

Maintained by: Hybritech Innovation LTD

🛠️ Tech Stack
Layer	Technology
Backend	NestJS (Node.js)
ORM	Prisma
Database	MySQL
Realtime	Socket.IO, MQTT, Modbus
Queues	BullMQ (Redis)


if there any issue during migration like need to reset all data:
first: mkdir -p prisma/migrations/00000000000000_init

second : npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/00000000000000_init/migration.sql

thired: npx prisma migrate resolve --applied 00000000000000_init

four : npx prisma migrate status

five : npx prisma migrate dev --name add_new_feature