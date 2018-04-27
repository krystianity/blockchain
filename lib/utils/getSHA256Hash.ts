import * as SHA256 from "crypto-js/sha256";
export const getSHA256Hash = (input: string) => {
    return SHA256(input).toString();
};
