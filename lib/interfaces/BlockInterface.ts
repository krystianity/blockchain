import TransactionInterface from "./TransactionInterface";

export default interface BlockInterface {
    index: number;
    previousHash: string;
    proof: number;
    timestamp: number;
    transactions: TransactionInterface[];
}
