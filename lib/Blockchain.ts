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

  constructor(config: ConfigInterface) {
    this.identifier = getNodeIdentifier();
    this.config = config;
    this.blockHandler = new BlockHandler(this, this.config.blockchain.difficulty);
    this.client = new HttpClient();
    this.chain = [];
    this.currentTransactions = [];
    this.nodes = new Set();
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
   * fetch all chains from known nodes and compare
   * chains, choose the longest valid one, if larger then
   * own
   * @returns {Promise<boolean>} if chain was switched
   */
  public async resolveConflicts(): Promise<boolean> {

    debug("resolving potential conflicts");

    const fetchPromises: Array<Promise<BlockInterface[]>> = [];
    this.nodes.forEach((host) => {
      fetchPromises.push(this.fetchChainFromNode(host));
    });

    return Promise.all(fetchPromises).then((chains) => {

      // We're only looking for chains longer than ours
      let newChain: BlockInterface[] = [];
      let maxLength: number = this.chain.length;

      chains.forEach((chain) => {
        // Check if the length is longer and the chain is valid
        if (chain.length > maxLength && this.blockHandler.isChainValid(chain)) {
          maxLength = chain.length;
          newChain = chain;
          debug("found longer chain", maxLength);
        }
      });

      // Replace our chain if we discovered a new, valid chain longer than ours
      if (newChain) {
        debug("replacing local chain");
        this.chain = newChain;
      }

      return !!newChain;
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
