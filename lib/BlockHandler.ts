import * as Debug from "debug";
const debug = Debug("blockchain:handler");

import Blockchain from "./Blockchain";
import {getSHA256Hash} from "./utils";
import BlockInterface from "./interfaces/BlockInterface";
import TransactionInterface from "./interfaces/TransactionInterface";

export default class BlockHandler {

    private blockchain: Blockchain;
    private proofRegex: any;

    constructor(blockchain: Blockchain, difficulty?: number) {
        this.blockchain = blockchain;
        this.proofRegex = this.buildRegex(difficulty || 4);
    }

    /**
     * returns the hash for a block
     * @param block
     * @returns {string} hash
     */
    public hash(block: BlockInterface): string {
        const blockString = JSON.stringify(block);
        return getSHA256Hash(blockString);
    }

    /**
     * creates a new block on the blockchain
     * @param proof
     * @param previousHash
     * @returns {object} created block
     */
    public newBlock(proof: number, previousHash: string): BlockInterface {

        const block: BlockInterface = {
            index: this.blockchain.getNextBlockIndex(),
            previousHash: previousHash || this.hash(this.lastBlock()),
            proof,
            timestamp: Date.now(),
            transactions: this.blockchain.getCurrentTransactions(),
        };

        debug("creating new block");

        this.blockchain.clearTransactions();
        this.blockchain.addBlock(block);
        return block;
    }

    /**
     * creates a new transaction on the blockchain
     * @param sender address of the sender
     * @param recipient address of the receiver
     * @param amount transaction amount
     * @param payload transaction payload
     * @returns {number} index of the block that will hold this transaction
     */
    public newTransaction(sender: string, recipient: string, amount: string, payload: any): number {

        const transaction: TransactionInterface = {
            amount,
            payload,
            recipient,
            sender,
        };

        debug("creating new transaction", sender, recipient, amount);

        this.blockchain.addTransaction(transaction);
        return this.blockchain.getNextBlockIndex();
    }

    /**
     * gets the last block of the chain
     * @returns {object} last block
     */
    public lastBlock(): BlockInterface {
        return this.blockchain.getLastBlock();
    }

    /**
     * simple proof of work algorithm
     * find a number p such that hash(pq) contains
     * certain amount of leading zeros, where previous p
     * is q
     * @param lastProof previous proof
     * @returns {number} new proof
     */
    public proofOfWork(lastProof: number): number {
        let proof = 0;
        while (!this.isProofValid(lastProof, proof)) {
            proof++;
        }
        debug("proofed work", lastProof, "as", proof);
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
     * validates a whole chain
     * @param {Array<Block>} chain internal chain of blocks
     * @returns {boolean} returns true of the chain is valid
     */
    public isChainValid(chain: BlockInterface[]) {
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
