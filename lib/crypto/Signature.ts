import * as Debug from "debug";
const debug = Debug("blockchain:signature");

import * as crypto from "crypto";

import ConfigInterface from "./../interfaces/ConfigInterface";
import TransactionInterface from "../interfaces/TransactionInterface";

import {PUBLIC_SOF} from "./Address";
import {PUBLIC_EOF} from "./Address";
import {PRIVATE_SOF} from "./Address";
import {PRIVATE_EOF} from "./Address";

const SHA256 = "sha256";
const HEX = "hex";

export default class Signature {

    private config: ConfigInterface;

    constructor(config: ConfigInterface) {
        this.config = config;
    }

    private transactionToString(transaction: TransactionInterface): string {
        return `${transaction.sender}:${transaction.recipient}:${transaction.amount}:` +
            `${transaction.payload || ""}:${transaction.timestamp || ""}`;
    }

    public createSignature(content: string, privateKey: string): string {

        const signer = crypto.createSign(SHA256);
        signer.update(content);
        signer.end();

        const key = `${PRIVATE_SOF}${privateKey}${PRIVATE_EOF}`;
        const signature = signer.sign(key);
        const signatureAsHex: string = signature.toString(HEX);

        return signatureAsHex;
    }

    public verifySignature(content: string, signatureAsHex: string, publicKey: string): boolean {

        const signature = Buffer.from(signatureAsHex, HEX);

        const verifier = crypto.createVerify(SHA256);
        verifier.update(content);
        verifier.end();

        const key = `${PUBLIC_SOF}${publicKey}${PUBLIC_EOF}`;
        const verified: boolean = verifier.verify(key, signature);

        if (verified) {
            debug("signature is valid");
        } else {
            debug("signature is invalid.");
        }

        return verified;
    }

    public createTransactionSignature(transaction: TransactionInterface, privateKey: string): string {
        return this.createSignature(this.transactionToString(transaction), privateKey);
    }

    public verifyTransactionSignature(transaction: TransactionInterface): boolean {

        if (!transaction || typeof transaction.signature === "undefined") {
            return false;
        }

        // transaction for a mined block
        if (transaction.sender === this.config.blockchain.mintAddress && !transaction.signature) {
            return true;
        }

        return this.verifySignature(this.transactionToString(transaction), transaction.signature, transaction.sender);
    }
}
