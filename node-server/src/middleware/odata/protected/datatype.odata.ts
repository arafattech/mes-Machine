import { Prisma } from "@prisma/client";

export function prismaFieldType(modelName: string, fieldName: string) {
    const model = Prisma.dmmf.datamodel.models.find(
        (model) => model.name.toLowerCase() === modelName.toLowerCase()
    );

    if (!model) return null;

    const field = model.fields.find((field) => field.name === fieldName);
    return field ? field.type : null;
}

