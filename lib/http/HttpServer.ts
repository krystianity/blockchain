// import * as Promise from "bluebird";
import * as bodyParser from "body-parser";
import * as cors from "cors";
import * as express from "express";

import App from "./../App";
import Blockchain from "./../Blockchain";
import BlockHandler from "./../BlockHandler";

import ConfigInterface from "./../interfaces/ConfigInterface";

export default class HttpServer {

  private config: ConfigInterface;
  private blockchain: Blockchain;
  private blockHandler: BlockHandler;
  private app?: any;
  private server?: any;

  constructor(parent: App) {

    const {config, blockchain} = parent;
    this.config = config;
    this.blockchain = blockchain;
    this.blockHandler = blockchain.getBlockHandler();

    this.app = express();
    this.server = null;
    this.init();
  }

  public async listen(): Promise<void> {
    await new Promise<null>((resolve, reject) => {
      this.server = this.app.listen(this.config.http.port, (error) => {
        if (error) {
          return reject(error);
        }
        resolve(null);
      });
    });
  }

  public close() {
    if (this.server) {
      this.server.close();
    }
  }

  private init(): void {

    this.app.use(cors());
    this.app.use(bodyParser.json({extended: false}));

    this.app.get("/api/mine", (req, res) => {

      // We run the proof of work algorithm to get the next proof...
      const lastBlock = this.blockchain.getLastBlock();
      const lastProof = lastBlock.proof;
      const proof = this.blockHandler.proofOfWork(lastProof);

      // We must receive a reward for finding the proof.
      // The sender is "0" to signify that this node has mined a new coin.
      this.blockchain.blockHandler.newTransaction("0", this.blockchain.identifier, "1", {});

      // Forge the new Block by adding it to the chain
      const previousHash = this.blockHandler.hash(lastBlock);
      const block = this.blockHandler.newBlock(proof, previousHash);

      res.status(201).json({
        block,
      });
    });

    this.app.post("/api/transactions/new", (req, res) => {

      const {sender, recipient, amount, payload} = req.body;

      if (!(sender && recipient && amount && payload)) {
        return res.status(400).json({
          error: "Missing sender, recipient, amount or payload on body.",
        });
      }

      const index = this.blockHandler.newTransaction(sender, recipient, amount, payload);

      res.status(201).json({
        message: `Transaction might be added to block ${index}.`,
      });
    });

    this.app.get("/api/chain", (req, res) => {
      res.status(200).json({
        chain: this.blockchain.getChain(),
      });
    });

    this.app.get("/api/stats", (req, res) => {
      res.status(200).json({
        length: this.blockchain.getLength(),
        nodes: this.blockchain.getNodesAsList(),
      });
    });

    this.app.post("/api/nodes/register", (req, res) => {

      const {nodes} = req.body;

      if (!nodes) {
        return res.status(400).json({
          error: "Missing nodes field on body.",
        });
      }

      nodes.forEach((node) => {
        this.blockchain.registerNode(node);
      });

      res.status(200).json({
        message: "Added nodes",
        totalNodes: this.blockchain.getNodesCount(),
      });
    });

    this.app.get("/api/nodes/resolve", async (req, res) => {

      const replaced = await this.blockchain.resolveConflicts();

      res.status(200).json({
        message: "Synced with nodes.",
        replaced,
      });
    });

  }
}
