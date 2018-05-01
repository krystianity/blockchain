export default interface TransferInterface {
    blockindex: number;
    previoushash: string;
    proof: number;
    blocktimestamp: number;
    recipient: string;
    sender: string;
    payload: string;
    signature: string;
    timestamp: number;
    amount: number;
}
