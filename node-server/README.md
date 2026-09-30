📦 Node.js OData API
A RESTful API built using Node.js, OData for flexible data querying, and Prisma ORM for clean, type-safe database access.

🏢 Project Info
Company: Hybritech Innovation LTD

Author: Shihab

Authentication: Custom implementation (e.g., JWT/OAuth)

Maintained by: Hybritech Innovation LTD

🛠️ Tech Stack
Layer	Technology
Backend	Node.js
API Protocol	OData v4
ORM	Prisma
Database	PostgreSQL / MySQL (please specify if needed)
Auth Mechanism	JWT or OAuth


<!-- Odata querys -->

$orderby=id desc
$orderby=id desc name asc

edit :
     Products(3)

delete : 
     Products(2)     


expand relation
        odata/Products?$expand=orders


only count : 
        odata/Products/$count 
        



http://localhost:3000/odata/v8/payrolls?$sum=basic_salary&$filter=employee_id eq 598


if there any issue during migration like need to reset all data:
first: mkdir -p prisma/migrations/00000000000000_init

second : npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/00000000000000_init/migration.sql

thired: npx prisma migrate resolve --applied 00000000000000_init

four : npx prisma migrate status

five : npx prisma migrate dev --name add_new_feature