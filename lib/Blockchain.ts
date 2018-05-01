import * as Debug from "debug";
const debug = Debug("blockchain:blockchain");

import BlockHandler from "./BlockHandler";
import Signature from "./crypto/Signature";
import Address from "./crypto/Address";
import Database from "./db/Database";
import ConfigInterface from "./interfaces/ConfigInterface";
import BlockInterface from "./interfaces/BlockInterface";
import TransactionInterface from "./interfaces/TransactionInterface";
import Peer from "./Peer";
import {parseHost} from "./utils";
import AddressInterface from "./interfaces/AddressInterface";

export default class Blockchain {

  private config: ConfigInterface;
  public nodeAddress: AddressInterface;
  public blockHandler: BlockHandler;
  public signature: Signature;
  public address: Address;
  private db: Database;
  private currentTransactions: TransactionInterface[];
  private conflictResolvationRunning: boolean;
  private p2p: Peer;

  constructor(config: ConfigInterface) {
    this.config = config;

    const {difficulty, nodeAddress} = this.config.blockchain;

    this.db = new Database(config);
    this.blockHandler = new BlockHandler(this, this.db, difficulty);
    this.signature = new Signature(config);
    this.address = new Address(config);

    // if no address is configured, generate a new one
    this.nodeAddress = nodeAddress || this.address.createAddress();
    this.currentTransactions = [];
    this.conflictResolvationRunning = false;
    this.p2p = new Peer(config);
  }

  /**
   * adds a new node to the node list (is proxy function)
   * @param address address of the node e.g. http://localhost:1337
   */
  public registerNode(address: string): void {
    this.p2p.registerNode(address);
  }

  /**
   * removes a node from the node list (is proxy function)
   * @param address
   */
  public removeNode(address: string): void {
   this.p2p.removeNode(address);
  }

  /**
   * register this node on another using the advertised hostname (is proxy function)
   * @param host
   */
  public async registerSelfAtOtherNode(host: string): Promise<boolean> {
    return await this.p2p.registerSelfAtOtherNode(host);
  }

  /**
   * resolve conflicts faster by only fetching the chain sizes
   * from the nodes
   */
  public async resolveConflicts(): Promise<boolean> {

    debug("resolving conflicts fast.");

    if (this.conflictResolvationRunning) {
      debug("conflict resolvation still running.");
      return false;
    }
    this.conflictResolvationRunning = true;

    const resolveRecursive = async () => {

      if (!this.getNodesCount()) {
        debug("no more nodes left");
        return false;
      }

      const {host} = await this.findLeadingNode();

      if (host === null) {
        debug("current node is leading node.");
        return false;
      }

      const chain = await this.p2p.fetchChainFromNode(host);
      if (!chain || !chain.length) {
        // if fetch fails, remove node and try again
        debug("fetch failed, removing node");
        this.removeNode(host);
        return resolveRecursive();
      }

      const oldLength = await this.getLength();

      // chain is too large to handle, store it in db first
      // (TODO: this should be rebuild to streaming chunks for future scaling)
      await this.db.replaceFullChain(chain);
      debug("replacing chain with", chain.length, "from", host);

      if (await this.getLength() < oldLength) {
        debug("fetched chain is smaller than expected, removing node");
        this.removeNode(host);
        return resolveRecursive();
      }

      if (!this.blockHandler.isChainValid()) {
        debug("fetched chain is invalid, removing node");
        this.removeNode(host);
        return resolveRecursive();
      }

      debug("fetched and exchanged chain is valid, synced with", host);
      return true;
    };

    return resolveRecursive().then((result) => {
      this.conflictResolvationRunning = false;
      return result;
    }).catch((error) => {
      this.conflictResolvationRunning = false;
      debug("conflict resolvation failed with error", error.message);
      return false;
    });
  }

  /**
   * searches for the leading node amonst all known nodes
   * using their chains length
   */
  public async findLeadingNode(): Promise<{host: string|null, length: number}> {

    debug("searching for leading node");

    const fetchPromises: Array<Promise<{host: string, length: number}>> = [];
    this.p2p.nodes.forEach((host) => {
      fetchPromises.push(this.p2p.fetchChainLengthFromNode(host).then((length) => {
        return {
          host,
          length,
        };
      }));
    });

    return Promise.all(fetchPromises).then(async (results) => {

      let leadingHost: string|null = null;
      let maxLength: number = await this.getLength();

      results.forEach(({host, length}) => {
        if (length > maxLength) {
          leadingHost = host;
          maxLength = length;
        }
      });

      return {
        host: leadingHost,
        length: maxLength,
      };
    });
  }

  /**
   * inform all other known nodes about the transaction
   * @param transaction
   * @param signature
   */
  public async publishTransactionToKnownNodes(transaction: TransactionInterface)
    : Promise<boolean[]> {

    const publishPromises: Array<Promise<boolean>> = [];
    this.p2p.nodes.forEach((host) => {
      publishPromises.push(this.p2p.publishTransaction(transaction, host));
    });

    return Promise.all(publishPromises);
  }

  /**
   * inform all other nown nodes about the block
   * @param block
   */
  public async publishBlockToKnownNodes(block: BlockInterface): Promise<boolean[]> {

    const publishPromises: Array<Promise<boolean>> = [];
    this.p2p.nodes.forEach((host) => {
      publishPromises.push(this.p2p.publishBlock(block, host));
    });

    return Promise.all(publishPromises);
  }

  public applyTransactionInformation(newTransaction: TransactionInterface): boolean {

    let found = false;
    this.currentTransactions.forEach((transaction) => {
      if (newTransaction.sender === transaction.sender &&
        newTransaction.recipient === transaction.recipient) {
        found = true;
      }
    });

    if (found) {
      debug("transaction already exists, wont add.");
      return false;
    }

    debug("transaction does not exist, adding");
    this.addTransaction(newTransaction);
    return true;
  }

  public applyBlockInformation(block: BlockInterface): boolean {
    // TODO: add block if it does not exist
    return false;
  }

  public getNodesAsList(): string[] {

    const list: string[] = [];
    this.p2p.nodes.forEach((host) => {
      list.push(host);
    });

    return list;
  }

  public getNodesCount(): number {
    return this.p2p.nodes.size;
  }

  public getBlockHandler(): BlockHandler {
    return this.blockHandler;
  }

  public getDatabase(): Database {
    return this.db;
  }

  /**
   * db-proxy
   */
  public async getLength(): Promise<number> {
    return this.db.getChainLength();
  }

  public async getNextBlockIndex(): Promise<number> {
    return (await this.getLength()) + 1;
  }

  public getCurrentTransactions(): TransactionInterface[] {
    return this.currentTransactions;
  }

  public clearTransactions(): void {
    this.currentTransactions = [];
  }

  /**
   * db-proxy
   */
  public async getLastBlock(): Promise<BlockInterface|null> {
    return this.db.getLastBlock();
  }

  /**
   * db-proxy
   */
  public streamChainFromDB(): any {
    return this.db.getWholeChain();
  }

  /**
   * db proxy
   * @param block
   */
  public async addBlock(block: BlockInterface): Promise<void> {
    await this.db.storeBlock(block);
  }

  /**
   * db proxy
   * @param address
   */
  public async getAddressBalance(address: string): Promise<number> {
    return await this.db.getBalanceOfAddress(address);
  }

  /**
   * db proxy
   * @param address
   */
  public async getAddressTransactions(address: string): Promise<TransactionInterface[]> {
    return await this.db.getTransactionsOfAddress(address);
  }

  /**
   * adds a new transaction and publishes it
   * to the other known nodes
   * @param transaction
   * @param publish
   */
  public async addTransaction(transaction: TransactionInterface, publish: boolean = true): Promise<number> {

    this.currentTransactions.push(transaction);

    if (publish) {
      this.publishTransactionToKnownNodes(transaction).catch(() => {
        // empty
      });
    }

    return await this.getNextBlockIndex();
  }

  public async init(): Promise<void> {

    await this.db.init();

    const lastBlock = await this.db.getLastBlock();

    if (!lastBlock) {

      this.addTransaction({
        amount: 0,
        sender: this.config.blockchain.mintAddress,
        recipient: this.config.blockchain.mintAddress,
        timestamp: Date.now(),
        payload: "",
        signature: "",
      }, false);

      await this.blockHandler.newBlock(100, "1");
      debug("no block present, created genisis block");
    } else {
      debug("blocks present, wont create genisis block");
    }

    // in case that other nodes are configured, we can get updated
    await this.resolveConflicts();
  }

  public close(): void {
    this.db.close();
  }
}
