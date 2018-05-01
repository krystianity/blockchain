import * as Debug from "debug";
const debug = Debug("blockchain:address");

import * as keypair from "keypair";
import ConfigInterface from "../interfaces/ConfigInterface";
import AddressInterface from "../interfaces/AddressInterface";

export const PUBLIC_SOF = "-----BEGIN RSA PUBLIC KEY-----\n";
export const PUBLIC_EOF = "\n-----END RSA PUBLIC KEY-----\n";
export const PRIVATE_SOF = "-----BEGIN RSA PRIVATE KEY-----\n";
export const PRIVATE_EOF = "\n-----END RSA PRIVATE KEY-----\n";

const PUBLIC_SOF_LENGTH = PUBLIC_SOF.length;
const PUBLIC_EOF_LENGTH = PUBLIC_EOF.length;
const PRIVATE_SOF_LENGTH = PRIVATE_SOF.length;
const PRIVATE_EOF_LENGTH = PRIVATE_EOF.length;

export default class Address {

    private config: ConfigInterface;

    constructor(config: ConfigInterface) {
        this.config = config;
    }

    public createAddress(): AddressInterface {

        debug("creating new address..");
        const startT = Date.now();

        const pair = keypair(this.config.addressOpts);
        const address: AddressInterface = {
            address: pair.public.substr(PUBLIC_SOF_LENGTH,
                pair.public.length - PUBLIC_EOF_LENGTH - PUBLIC_SOF_LENGTH),
            privateKey: pair.private.substr(PRIVATE_SOF_LENGTH,
                pair.private.length - PRIVATE_EOF_LENGTH - PRIVATE_SOF_LENGTH),
        };

        debug("created address in ", Date.now() - startT, "ms");
        return address;
    }
}
