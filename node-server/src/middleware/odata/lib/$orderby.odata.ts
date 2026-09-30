  export const parseOrderBy=(orderByStr: string)=>{
    const [field, direction] = orderByStr.split(' ');
    return { [field]: direction?.toLowerCase() === 'desc' ? 'desc' : 'asc' };
  }