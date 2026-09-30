export const parseSelect =(selectStr: string)=>{
    const fields = selectStr.split(',').map((filed: any) => filed.trim());
    const select: any = {};
    fields.forEach((selectTable: any) => (select[selectTable] = true));
    return select;
  }