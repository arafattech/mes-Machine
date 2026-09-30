export const parseCount = ($count: string) => {
    const MainString = $count?.split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    const select: Record<string, true> = {};
    let main = false;

    if (MainString) {
        for (const count of MainString) {

            if (count === 'true') {
                main = true;
                continue;
            }

            if (count === 'false') {
                main = false
                continue;
            }

            select[count] = true;
        }
    }

    return {
        data: {
            _main: main,
            _count: {
                select
            }
        }
    };
};
