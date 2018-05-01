import * as Debug from "debug";
const debug = Debug("blockchain:handler");

import Blockchain from "./Blockchain";
import Database from "./db/Database";

import {getSHA256Hash} from "./utils";
import BlockInterface from "./interfaces/BlockInterface";
import TransactionInterface from "./interfaces/TransactionInterface";

export default class BlockHandler {

    private blockchain: Blockchain;
    private db: Database;
    private proofRegex: any;

    constructor(blockchain: Blockchain, db: Database, difficulty?: number) {
        this.blockchain = blockchain;
        this.db = db;
        this.proofRegex = this.buildRegex(difficulty || 4);

        // TODO: BlockHandler <-> Blockchain relationship could be refactored
    }

    /**
     * returns the hash for a block
     * @param block
     */
    public hash(block: BlockInterface|null): string {

        if (block === null) {
            throw new Error("Cannot hash block that is null.");
        }

        const blockString = JSON.stringify(block);
        return getSHA256Hash(blockString);
    }

    /**
     * creates a new block on the blockchain
     * @param proof
     * @param previousHash
     */
    public async newBlock(proof: number, previousHash: string): Promise<BlockInterface> {

        const block: BlockInterface = {
            index: await this.blockchain.getNextBlockIndex(),
            previousHash: previousHash || this.hash(await this.lastBlock()),
            proof,
            timestamp: Date.now(),
            transactions: this.blockchain.getCurrentTransactions(),
        };

        debug("creating new block");

        this.blockchain.clearTransactions();
        await this.blockchain.storeBlock(block);
        return block;
    }

    /**
     * gets the last block of the chain
     */
    public async lastBlock(): Promise<BlockInterface|null> {
        return await this.blockchain.getLastBlock();
    }

    /**
     * simple proof of work algorithm
     * find a number p such that hash(pq) contains
     * certain amount of leading zeros, where previous p
     * is q
     * @param lastProof previous proof
     */
    public proofOfWork(lastProof: number): number {
        debug("searching for proof for", lastProof);
        const startT = Date.now();
        let proof = 0;
        while (!this.isProofValid(lastProof, proof)) {
            proof++;
        }
        const duration = Date.now() - startT;
        debug("found proof", proof, "for previous", lastProof, "in", duration, "ms");
        return proof;
    }

    /**
     * validates the proof
     * if the hash of the last proof and new proof
     * starts with 4 zeros
     * @param lastProof
     * @param proof
     */
    public isProofValid(lastProof: number, proof: number): boolean {
        const guess = `${lastProof}:${proof}`;
        const guessHash = getSHA256Hash(guess);
        return this.proofRegex.test(guessHash);
    }

    /**
     * validates a block and its transactions
     * @param block
     */
    public isBlockValid(block: BlockInterface): boolean {

        if (!block || !block.previousHash || !block.proof ||
            !block.transactions || !block.transactions.length) {
            debug("block is invalid");
            return false;
        }

        let invalidTransactionFound = false;
        block.transactions.forEach((transaction) => {
            if (!this.blockchain.signature.verifyTransactionSignature(transaction)) {
                invalidTransactionFound = true;
            }
        });

        if (invalidTransactionFound) {
            debug("block contains invalid transaction");
            return false;
        }

        return true;
    }

    /**
     * checks if the current chain is valid
     */
    public async isChainValid(chain: BlockInterface[]) {

        let index = 1;
        while (index < chain.length) {
            const previousBlock = chain[index - 1];
            const block = chain[index];

            // check that all hashes of blocks are correct
            if (block.previousHash !== this.hash(previousBlock)) {
                return false;
            }

            // check that the proof of work of the block is correct
            if (!this.isProofValid(previousBlock.proof, block.proof)) {
                return false;
            }

            index++;
        }

        return true;
    }

    /**
     * generates a regex to validate
     * the proof of work (leading zeros)
     * @param difficulty
     */
    private buildRegex(difficulty: number): any {
        const regHashStart: string[] = [];
        for (let i = 0; i < difficulty; i++) {
            regHashStart.push("0");
        }
        return new RegExp(`^${regHashStart.join("")}`);
    }
}
