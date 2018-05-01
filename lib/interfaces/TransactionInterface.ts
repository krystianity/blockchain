export default interface TransactionInterface {
    amount: number;
    recipient: string;
    sender: string;
    payload: string;
    signature?: string;
    timestamp?: number;
}
