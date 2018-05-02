import * as Debug from "debug";
const debug = Debug("blockchain:peer");

import BlockHandler from "./BlockHandler";
import ConfigInterface from "./interfaces/ConfigInterface";
import BlockInterface from "./interfaces/BlockInterface";
import TransactionInterface from "./interfaces/TransactionInterface";
import HttpClient from "./http/HttpClient";
import {parseHost} from "./utils";
import TransferInterface from "./interfaces/TransferInterface";

export default class Peer {

  public nodes: Set<string>;
  public proto: string;
  private config: ConfigInterface;
  private client: HttpClient;

  constructor(config: ConfigInterface) {
    this.config = config;
    this.client = new HttpClient();
    this.nodes = new Set();
    this.proto = this.config.blockchain.protocol;
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
   * get a chain (streamed transfer format) from another node
   * @param host node host
   */
  public async fetchChainFromNode(host: string): Promise<TransferInterface[]> {

    debug("fetching chain from", host);

    try {

      const {status, body} = await this.client.call({
        method: "GET",
        url: `${this.proto}${host}/api/peer/chain`,
        timeout: 5000,
      });

      if (status === 200) {
        return body;
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
        url: `${this.proto}${host}/api/stats`,
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
   * register this node on another using the advertised hostname
   * @param url
   */
  public async registerSelfAtOtherNode(url: string): Promise<boolean> {

    const host: string = parseHost(url);
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
        url: `${this.proto}${host}/api/nodes/register`,
        timeout: 5000,
      });

      if (status === 200) {
        debug("registered self at other node", host);
        return true;
      }

      debug("failed to register on node", host, status);
      return false;
    } catch (error) {
      debug("failed to register on node", host, error.message);
      return false;
    }
  }

  /**
   * informs another node about a transaction
   * @param transaction
   * @param host
   */
  public async publishTransaction(transaction: TransactionInterface, host: string)
    : Promise<boolean> {

    try {

        const {status, body} = await this.client.call({
            body: JSON.stringify({
                transaction,
            }),
            headers: {
                "content-type": "application/json",
            },
            method: "POST",
            url: `${this.proto}${host}/api/peer/transaction`,
            timeout: 5000,
        });

        if (status === 200) {
            debug("published transaction to other node", host);
            return true;
        } else if (status === 503) {
          debug("other node is busy", host);
          return false;
        }

        debug("failed to publish transaction to other node", host, status);
        this.removeNode(host);
        return false;
    } catch (error) {
        debug("failed to publish transaction to other node, with error", host, error.message);
        this.removeNode(host);
        return false;
    }
  }

  /**
   * informs another node about a new block
   * @param block
   * @param host
   */
  public async publishBlock(block: BlockInterface, host: string): Promise<boolean> {

    try {

        const {status, body} = await this.client.call({
            body: JSON.stringify({
                block,
            }),
            headers: {
                "content-type": "application/json",
            },
            method: "POST",
            url: `${this.proto}${host}/api/peer/block`,
            timeout: 5000,
        });

        if (status === 200) {
            debug("published block to other node", host);
            return true;
        } else if (status === 503) {
          debug("other node is busy", host);
          return false;
        }

        debug("failed to publish block to other node", host, status);
        this.removeNode(host);
        return false;
    } catch (error) {
        debug("failed to publish block to other node, with error", host, error.message);
        this.removeNode(host);
        return false;
    }
  }

}
