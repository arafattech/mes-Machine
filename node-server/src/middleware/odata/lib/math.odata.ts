export const parseSum = ($sum: string) => {
    const MainString = $sum?.split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    const fields: any = {};
    let main = false;

    if (MainString) {
        for (const item of MainString) {

            if (item === 'true') {
                main = true;
                continue;
            }

            if (item === 'false') {
                continue;
            }

            fields[item] = true;
        }
    }

    return {
        data: {
            _main: main,
            _sum: fields
        }
    };
};




// perse avarage , avg 


export const parseAvg = ($avg: string) => {
    const MainString = $avg?.split(',')
        .map((value) => value?.trim())
        .filter(Boolean);

    const fields: Record<string, true> = {};
    let main = false;

    if (MainString) {
        for (const item of MainString) {

            if (item === 'true') {
                main = true;
                continue;
            }

            if (item === 'false') {
                continue;
            }

            fields[item] = true;
        }
    }

    return {
        data: {
            _main: main,
            _avg: fields
        }
    };
};
