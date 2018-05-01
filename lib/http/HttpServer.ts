import * as bodyParser from "body-parser";
import * as cors from "cors";
import * as express from "express";

import App from "./../App";
import Blockchain from "./../Blockchain";
import BlockHandler from "./../BlockHandler";

import ConfigInterface from "./../interfaces/ConfigInterface";
import TransactionInterface from "../interfaces/TransactionInterface";
import BlockInterface from "../interfaces/BlockInterface";

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

    this.app.get("/", (req, res) => {
      res.status(200).end("BLOCKCHAIN");
    });

    /**
     * dont use this endpoint in production (for testing only)
     */
    this.app.get("/api/address/new", (req, res) => {
      const address = this.blockchain.address.createAddress();
      res.status(200).json({
        address,
      });
    });

    /**
     * dont use this endpoint in production (for testing only)
     */
    this.app.post("/api/transactions/sign", (req, res) => {

      const transaction: TransactionInterface = req.body.transaction;
      const address: string = req.body.address;
      const privateKey: string = req.body.privateKey;

      transaction.sender = address;
      const signature: string = this.blockchain.signature.createTransactionSignature(transaction, privateKey);
      transaction.signature = signature;

      res.status(200).json({
        transaction,
      });
    });

    this.app.get("/api/mine", async (req, res) => {

      const lastBlock = await this.blockchain.getLastBlock();

      if (!lastBlock) {
        return res.status(500).json({
          error: "No previous block to mine from",
        });
      }

      const lastProof = lastBlock.proof;
      const proof = this.blockHandler.proofOfWork(lastProof);

      // We must receive a reward for finding the proof.
      // The sender is "0" to signify that this node has mined a new coin.

      const transaction: TransactionInterface = {
        sender: this.config.blockchain.mintAddress,
        recipient: this.blockchain.nodeAddress.address,
        amount: this.config.blockchain.mintReward,
        payload: "",
        signature: "",
        timestamp: Date.now(),
      };

      this.blockchain.addTransaction(transaction, false);
      const previousHash = this.blockHandler.hash(lastBlock);
      const block = this.blockHandler.newBlock(proof, previousHash);

      res.status(201).json({
        block,
      });
    });

    this.app.post("/api/transactions/new", (req, res) => {

      if (!req.body || typeof req.body !== "object") {
        return res.status(400).json({
          error: "Body must be an object.",
        });
      }

      const {sender, recipient, amount, signature, timestamp} = req.body;
      let {payload} = req.body;

      if (!(sender && recipient && amount && payload && signature && timestamp)) {
        return res.status(400).json({
          error: "Missing sender, recipient, amount, payload, timestamp or signature on body.",
        });
      }

      if (!payload) {
        payload = "";
        req.body.payload = "";
      }

      if (typeof payload !== "string" || payload.length > 254) {
        return res.status(400).json({
          error: "payload should be a string with a max length of 254",
        });
      }

      // cannot be created, must be mined
      if (sender === "0") {
        return res.status(400).json({
          error: "New transactions with a mined block sender, are not accepted.",
        });
      }

      const newTransaction: TransactionInterface = req.body;
      if (!this.blockchain.signature.verifyTransactionSignature(newTransaction)) {
        return res.status(400).json({
          error: "Bad transaction signature.",
        });
      }

      const index = this.blockchain.addTransaction(newTransaction);

      res.status(201).json({
        message: `Transaction might be added to block ${index}.`,
        blockIndex: index,
        transaction: newTransaction,
      });
    });

    this.app.get("/api/peer/chain", (req, res) => {

      res.status(200);
      res.set("content-type", "application/json");
      res.write("[ ");

      const stream$ = this.blockchain.streamChainFromDB();
      stream$.on("row", (row) => {
        res.write(JSON.stringify(row));
        res.write(", ");
      });

      stream$.on("end", () => {
        res.write("null");
        res.write(" ]");
        res.end();
      });
    });

    this.app.get("/api/stats", async (req, res) => {
      res.status(200).json({
        length: await this.blockchain.getLength(),
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

    this.app.post("/api/peer/transaction", async (req, res) => {

      const transaction: TransactionInterface = req.body.transaction;

      if (transaction && transaction.sender === "0") {
        return res.status(400).json({
          error: "Peer transaction with a mined block sender, are not accepted.",
        });
      }

      if (!this.blockchain.signature.verifyTransactionSignature(transaction)) {
        return res.status(400).json({
          error: "Bad transaction signature.",
        });
      }

      const applied = this.blockchain.applyTransactionInformation(transaction);

      res.status(200).json({
        applied,
      });
    });

    this.app.post("/api/peer/block", async (req, res) => {

      const block: BlockInterface = req.body.block;
      const applied = this.blockchain.applyBlockInformation(block);

      res.status(200).json({
        applied,
      });
    });

    this.app.post("/api/address/transactions", async (req, res) => {

      if (!req.body || !req.body.address) {
        return res.status(400).json({
          error: "Missing address on body.",
        });
      }

      const transactions = await this.blockchain.getAddressTransactions(req.body.address);

      if (!transactions || !transactions.length) {
        return res.status(404).json({
          error: "Address not known on blockchain.",
        });
      }

      res.status(200).json({
        transactions,
      });
    });

    this.app.post("/api/address/balance", async (req, res) => {

      if (!req.body || !req.body.address) {
        return res.status(400).json({
          error: "Missing address on body.",
        });
      }

      const balance = await this.blockchain.getAddressBalance(req.body.address);

      if (balance === -1) {
        return res.status(404).json({
          error: "Address not known on blockchain.",
        });
      }

      res.status(200).json({
        balance,
      });
    });

    this.app.get("/api/blocks/last", async (req, res) => {
      const lastBlock = await this.blockchain.getLastBlock();
      res.status(200).json({
        block: lastBlock,
      });
    });
  }
}
