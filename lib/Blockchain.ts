import * as Debug from "debug";
const debug = Debug("blockchain:blockchain");

import BlockHandler from "./BlockHandler";
import ConfigInterface from "./interfaces/ConfigInterface";
import BlockInterface from "./interfaces/BlockInterface";
import TransactionInterface from "./interfaces/TransactionInterface";
import HttpClient from "./http/HttpClient";
import {parseHost, getNodeIdentifier} from "./utils";

export default class Blockchain {

  public identifier: string;
  public blockHandler: BlockHandler;
  private config: ConfigInterface;
  private client: HttpClient;
  private chain: BlockInterface[];
  private currentTransactions: TransactionInterface[];
  private nodes: Set<string>;
  private conflictResolvationRunning: boolean;

  constructor(config: ConfigInterface) {
    this.identifier = getNodeIdentifier();
    this.config = config;
    this.blockHandler = new BlockHandler(this, this.config.blockchain.difficulty);
    this.client = new HttpClient();
    this.chain = [];
    this.currentTransactions = [];
    this.nodes = new Set();
    this.conflictResolvationRunning = false;
  }

  /**
   * adds a new node to the node list
   * @param address address of the node e.g. http://localhost:1337
   */
  public registerNode(address: string): void {
    const host: string = parseHost(address);
    this.nodes.add(host);
    debug("registering", host, "as new node");
  }

  /**
   * removes a node from the node list
   * @param address
   */
  public removeNode(address: string): void {
    debug("removing node", address);
    this.nodes.delete(address);
  }

  /**
   * get a chain from another node
   * @param host node host
   * @returns {Array<object>} chain from the node
   */
  public async fetchChainFromNode(host: string): Promise<BlockInterface[]> {

    debug("fetching chain from", host);

    try {

      const {status, body} = await this.client.call({
        method: "GET",
        url: `http://${host}/api/chain`,
        timeout: 5000,
      });

      if (status === 200) {
        const chain: BlockInterface[] = body.chain;
        return chain;
      }

      debug("failed to fetch chain from node", host, status);
      return [];
    } catch (error) {
      debug("failed to fetch chain from node", host, error.message);
      return [];
    }
  }

  /**
   * fetches chain length of other node
   * @param host
   */
  public async fetchChainLengthFromNode(host: string): Promise<number> {

    try {

      const {status, body} = await this.client.call({
        method: "GET",
        url: `http://${host}/api/stats`,
        timeout: 5000,
      });

      if (status === 200) {
        debug("fetched chain length from", host, "is", body.length);
        return body.length;
      }

      debug("failed to fetch chain lengthfrom node", host, status);
      return -1;
    } catch (error) {
      debug("failed to fetch chain length node", host, error.message);
      return -1;
    }
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

      const chain = await this.fetchChainFromNode(host);
      if (!chain || !chain.length) {
        // if fetch fails, remove node and try again
        debug("fetch failed, removing node");
        this.removeNode(host);
        return resolveRecursive();
      }

      if (chain.length < this.getLength() && !this.blockHandler.isChainValid(chain)) {
        debug("fetched chain is invalid, removing node");
        this.removeNode(host);
        return resolveRecursive();
      }

      this.chain = chain;
      debug("replacing chain with", chain.length, "from", host);
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
    this.nodes.forEach((host) => {
      fetchPromises.push(this.fetchChainLengthFromNode(host).then((length) => {
        return {
          host,
          length,
        };
      }));
    });

    return Promise.all(fetchPromises).then((results) => {

      let leadingHost: string|null = null;
      let maxLength: number = this.getLength();

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
   * register this node on another using the advertised hostname
   * @param host
   * @returns {boolean} if the operation was successfull
   */
  public async registerSelfAtOtherNode(host: string): Promise<boolean> {

    debug("registering at other node", host);

    try {

      const {status, body} = await this.client.call({
        body: JSON.stringify({
          nodes: [this.config.advertisedHost],
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
        url: `${host}/api/nodes/register`,
        timeout: 5000,
      });

      if (status === 200) {
        return true;
      }

      debug("failed to register on node", host, status);
      return false;
    } catch (error) {
      debug("failed to register on node", host, error.message);
      return false;
    }
  }

  public getNodesAsList(): string[] {

    const list: string[] = [];
    this.nodes.forEach((host) => {
      list.push(host);
    });

    return list;
  }

  public getNodesCount(): number {
    return this.nodes.size;
  }

  public getChain(): BlockInterface[] {
    return this.chain;
  }

  public getBlockHandler(): BlockHandler {
    return this.blockHandler;
  }

  public getLength(): number {
    return this.chain.length;
  }

  public getCurrentTransactions(): TransactionInterface[] {
    return this.currentTransactions;
  }

  public getLastBlock(): BlockInterface {
    return this.chain[this.chain.length - 1];
  }

  public getNextBlockIndex(): number {
    return this.chain.length + 1;
  }

  public clearTransactions(): void {
    this.currentTransactions = [];
  }

  public addBlock(block: BlockInterface): void {
    this.chain.push(block);
  }

  public addTransaction(transaction: TransactionInterface): void {
    this.currentTransactions.push(transaction);
  }

  public async init(): Promise<void> {

    // genesis block
    this.blockHandler.newBlock(100, "1");
  }

  public close(): void {
    // empty
  }
}
