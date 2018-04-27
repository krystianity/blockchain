import * as url from "url";

export const parseHost = (input: string): string => {
    const parsed: any = url.parse(input);
    const host: string = parsed.host;
    return host;
};
