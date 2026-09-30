import * as fs from 'fs';
import * as path from 'path';
import { scheduler } from 'timers/promises';
const { execSync } = require('child_process');

let args: string[] = [];
const rawArgs = process.argv.slice(2);
if (rawArgs.length === 1) {
  args = rawArgs[0].split(' ');
} else {
  args = rawArgs;
}

// === Create Module ===
if (args.length === 3 && args[0] === 'new' && args[1] === 'module') {
  const rawName = args[2];

  const moduleName = rawName
    .split(/[\s\-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  const moduleDir = moduleName.toLowerCase();

  const basePath = path.join(__dirname, '..', 'src', 'module', moduleDir);
  fs.mkdirSync(basePath, { recursive: true });

  // ============ need for further development ================

  // fs.mkdirSync(path.join(basePath, 'database'), { recursive: true });  
  // fs.writeFileSync(
  //   path.join(basePath, 'database', `${moduleDir}.prisma`),
  //   `// ${moduleName} Database initialization code here\n`,
  //   'utf-8',
  // );

  const controllerContent = `import { Controller, Get } from '@nestjs/common';

@Controller()
export class ${moduleName}Controller {
  @Get()
  getHello() {
    return { message: '${moduleName} works' };
  }
}
`;

  const serviceContent = `import { Injectable } from '@nestjs/common';

@Injectable()
export class ${moduleName}Service {
  // Service methods here
}
`;

  const moduleContent = `import { Module } from '@nestjs/common';
import { ${moduleName}Controller } from '@module/${moduleDir}/${moduleDir}.controller';
import { ${moduleName}Service } from '@module/${moduleDir}/${moduleDir}.service';

@Module({
  controllers: [${moduleName}Controller],
  providers: [${moduleName}Service],
})
export class ${moduleName}Module {}
`;

  const routeContent = `import { Routes } from '@nestjs/core';
import { ${moduleName}Module } from '@module/${moduleDir}/${moduleDir}.module';

export const ${moduleName}Routes: Routes = [
  {
    path: '${moduleDir}',
    module: ${moduleName}Module,
  },
];
`;

  fs.writeFileSync(
    path.join(basePath, `${moduleDir}.controller.ts`),
    controllerContent,
    'utf-8',
  );
  fs.writeFileSync(
    path.join(basePath, `${moduleDir}.service.ts`),
    serviceContent,
    'utf-8',
  );
  fs.writeFileSync(
    path.join(basePath, `${moduleDir}.module.ts`),
    moduleContent,
    'utf-8',
  );
  fs.writeFileSync(path.join(basePath, `route.ts`), routeContent, 'utf-8');

  // === Update api.router.ts ===
  const routerFile = path.join(
    __dirname,
    '..',
    'src',
    'routers',
    'api.route.ts',
  );
  const importLine = `import { ${moduleName}Routes } from '@module/${moduleDir}/route';\n`;
  const spreadLine = `  ...${moduleName}Routes,`;

  let routerSource = fs.readFileSync(routerFile, 'utf-8');
  if (!routerSource.includes(importLine)) {
    routerSource = importLine + routerSource;
  }
  routerSource = routerSource.replace(
    /export const apiRoutes: Routes = \[/,
    `export const apiRoutes: Routes = [\n${spreadLine}`,
  );
  fs.writeFileSync(routerFile, routerSource, 'utf-8');

  // === Update app.module.ts ===
  const appModulePath = path.join(__dirname, '..', 'src', 'app.module.ts');
  let appModuleContent = fs.readFileSync(appModulePath, 'utf-8');

  const appImportLine = `import { ${moduleName}Module } from '@module/${moduleDir}/${moduleDir}.module';\n`;
  if (!appModuleContent.includes(appImportLine)) {
    appModuleContent = appImportLine + appModuleContent;
  }
  appModuleContent = appModuleContent.replace(
    /imports: \[/,
    `imports: [\n    ${moduleName}Module,`,
  );
  fs.writeFileSync(appModulePath, appModuleContent, 'utf-8');

  console.log(`Module "${moduleName}" created and registered successfully!`);
}

// === Merge DB ===
else if (args.length === 3 && args[0] === 'merge' && args[1] === 'db') {
  const moduleName = args[2];
  const modulePath = path.join(
    __dirname,
    '..',
    'src',
    'module',
    moduleName,
    'database',
    `${moduleName}.prisma`,
  );
  const outputPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

  if (!fs.existsSync(modulePath)) {
    console.error(` Module Prisma file not found: ${modulePath}`);
    process.exit(1);
  }

  const HEADER = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}`;

  let existing = fs.existsSync(outputPath)
    ? fs.readFileSync(outputPath, 'utf8')
    : HEADER;
  const moduleContent = fs.readFileSync(modulePath, 'utf8').trim();
  const namesToReplace = new Set<string>();

  const declarationRegex = /(model|enum|view)\s+(\w+)\s*\{[^}]*\}/g;
  let blockMatch;
  while ((blockMatch = declarationRegex.exec(moduleContent)) !== null) {
    const [, , name] = blockMatch;
    namesToReplace.add(name);
  }
  const mapRegex = /@@map\("([^"]+)"\)/g;
  let mapMatch;
  while ((mapMatch = mapRegex.exec(moduleContent)) !== null) {
    namesToReplace.add(mapMatch[1]);
  }

  const blockStripRegex = new RegExp(
    `(\\n+)?(model|enum|view)\\s+(\\w+)\\s*\\{[\\s\\S]+?\\n\\}(?=\\n|$)`,
    'g',
  );

  existing = existing.replace(blockStripRegex, (block) => {
    const nameMatch = /(model|enum|view)\s+(\w+)/.exec(block);
    const modelName = nameMatch?.[2];
    const mapMatch = /@@map\("([^"]+)"\)/.exec(block);
    const mappedName = mapMatch?.[1];

    if (
      namesToReplace.has(modelName!) ||
      (mappedName && namesToReplace.has(mappedName))
    ) {
      console.log(`🧹 Replacing existing model/view/enum: ${modelName}`);
      return '';
    }
    return block;
  });

  // Remove previous // 🌍 Module: ...
  const moduleCommentRegex = new RegExp(
    `\\n*// 🌍 Module: ${moduleName}[\\s\\S]*?(?=\\n// 🌍 Module:|\\s*$)`,
    'gm',
  );
  existing = existing.replace(moduleCommentRegex, '').trim();

  // Append new block
  const newSchema = `${existing.trim()}\n\n// 🌍 Module: ${moduleName}\n${moduleContent}\n`;

  fs.writeFileSync(outputPath, newSchema);
  console.log(` Merged module: ${moduleName} into schema.prisma`);

  try {
    execSync('npx prisma format', { stdio: 'inherit' });
    execSync('npx prisma validate', { stdio: 'inherit' });
    console.log('Schema formatted and validated!');
  } catch (err) {
    console.error(' Format or validate failed');
    process.exit(1);
  }

  try {
    // Generate OData models from Prisma schema
    const PRISMA_TO_EDM = {
      Int: '@Edm.Int32',
      BigInt: '@Edm.Int64',
      String: '@Edm.String',
      Boolean: '@Edm.Boolean',
      DateTime: '@Edm.DateTimeOffset',
      Float: '@Edm.Double',
      Decimal: '@Edm.Decimal',
    };

    const PRISMA_TO_TS = {
      Int: 'number',
      BigInt: 'number',
      Float: 'number',
      Decimal: 'number',
      String: 'string',
      Boolean: 'boolean',
      DateTime: 'Date',
    };

    const modelRegex = /model\s+(\w+)\s+{([^}]*)}/g;
    const modelDir = path.join(__dirname, `../src/models/${moduleName}`);
    fs.mkdirSync(modelDir, { recursive: true });

    let match;
    while ((match = modelRegex.exec(moduleContent)) !== null) {
      const [_, modelName, body] = match;

      const fields = body
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter(
          (line) =>
            line &&
            !line.startsWith('//') &&
            !line.startsWith('@@') &&
            !line.includes('@relation'),
        );

      const tsFields = fields.map((line) => {
        const parts = line.split(/\s+/);
        const [field, typeRaw] = parts;

        if (!field || !typeRaw) return null;

        const isOptional = typeRaw.includes('?');
        const type = typeRaw.replace('?', '');

        const tsType = PRISMA_TO_TS[type] || 'any';
        const edm = PRISMA_TO_EDM[type];
        const isKey = line.includes('@id');

        return [
          isKey ? `@Edm.Key` : null,
          edm ? `  ${edm}` : null,
          `  ${field}${isOptional ? '?' : ''}: ${tsType};`,
        ]
          .filter(Boolean)
          .join('\n');
      });

      const classDef = `
import { Edm } from 'odata-v4-server';

export class ${modelName} {
${tsFields.filter(Boolean).join('\n\n')}
}
`.trim();

      const outputTsPath = path.join(modelDir, `${modelName}.ts`);
      fs.writeFileSync(outputTsPath, classDef);
      console.log(`✨ Generated OData model: ${outputTsPath}`);
    }
  } catch (err) {
    console.error('❌ Error updating models:', err);
    process.exit(1);
  }
}

else if (
  args.length === 3 &&
  args[0] === 'fix' &&
  args[1] === 'prisma' &&
  args[2] === 'many-to-many'
) {
  const outputPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

  if (!fs.existsSync(outputPath)) {
    console.error(`Prisma schema file not found: ${outputPath}`);
    process.exit(1);
  }

  let schema = fs.readFileSync(outputPath, 'utf8');

  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;

  schema = schema.replace(modelRegex, (full, modelName, body) => {
    if (!body.includes('@@ignore')) return full;
    const indexRegex = /@@index\s*\(\s*\[([^\]]+)\]/g;
    const indexFields: string[] = [];

    let match;
    while ((match = indexRegex.exec(body)) !== null) {
      const fields = match[1]
        .split(',')
        .map(f => f.trim())
        .filter(Boolean);

      if (fields.length === 1) {
        indexFields.push(fields[0]);
      }
    }

    if (indexFields.length !== 2) return full;
    let updatedBody = body.replace(/@@ignore\s*/g, '');
    if (!/@@id\s*\(/.test(updatedBody)) {
      updatedBody =
        updatedBody.trimEnd() +
        `\n\n  @@id([${indexFields.join(', ')}])\n`;
    }
   console.log('model name', modelName , ' index fields', indexFields , ' updated body', updatedBody);
    return `model ${modelName} {\n${updatedBody}\n}`;
  });

  fs.writeFileSync(outputPath, schema, 'utf8');

}


// === Invalid command ===
else {
  console.error(' Invalid command.\nUsage:');
  console.error('  npm run hybri new module <ModuleName>');
  console.error('  npm run hybri merge db <AppName>');
  console.error('  npm run hybri fix prisma many-to-many');
  process.exit(1);
}
