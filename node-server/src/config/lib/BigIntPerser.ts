
// export function serializeBigInt(obj: any): any {
//   if (Array.isArray(obj)) return obj.map(serializeBigInt);

//   if (obj && typeof obj === 'object') {
//     const res: any = {};
//     for (const key in obj) {
//       if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
//       const value = obj[key];
//       res[key] = typeof value === 'bigint' ? value.toString() : serializeBigInt(value);
//     }
//     return res;
//   }

//   return obj;
// }

export function serializeBigInt(obj: any): any {

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt)
  }

  if( obj instanceof Date ) {
    return obj.toISOString();
  }

  if (
    obj &&
    typeof obj === 'object' &&
    typeof obj.toString === 'function' &&
    's' in obj &&
    'e' in obj &&
    'd' in obj
  ) {
    return obj.toString()
  }

  if (typeof obj === 'bigint') {
    return obj.toString()
  }

  if (obj && typeof obj === 'object') {
    const res: any = {}
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue
      res[key] = serializeBigInt(obj[key])
    }
    return res
  }

  return obj
}
