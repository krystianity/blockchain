import Blockchain from "./Blockchain";
import HttpServer from "./http/HttpServer";
import ConfigInterface from "./interfaces/ConfigInterface";

import * as Debug from "debug";
const debug = Debug("blockchain:app");

export default class App {

  public config: ConfigInterface;
  public blockchain: Blockchain;
  private server: HttpServer;

  constructor(config: ConfigInterface) {
    this.config = config;
    this.blockchain = new Blockchain(config);
    this.server = new HttpServer(this);
  }

  public async init(): Promise<void> {
    debug("starting..");
    await this.blockchain.init();
    await this.server.listen();
    debug("started");
  }

  public async close(): Promise<void> {
    debug("closing..");
    this.server.close();
    await this.blockchain.close();
  }
}
