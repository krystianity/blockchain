import * as Debug from "debug";
const debug = Debug("blockchain:database");

import * as EventEmitter from "events";
import * as Sequelize from "sequelize";
const Op = Sequelize.Op;
import ConfigInterface from "../interfaces/ConfigInterface";
import BlockInterface from "../interfaces/BlockInterface";
import TransactionInterface from "../interfaces/TransactionInterface";
import TransferInterface from "../interfaces/TransferInterface";

export default class Database {

    private config: ConfigInterface;
    private sequelize: any;
    private models: any;

    constructor(config: ConfigInterface) {
        this.config = config;
        this.sequelize = null;
    }

    public async init(): Promise<void> {

        debug("initialising..");
        const {database, username, password, storage} = this.config.database;

        this.sequelize = new Sequelize(database, username, password, {
            dialect: "sqlite",
            storage,
            logging: (query) => {
                // debug(query);
            },
          });

        await this.sequelize.authenticate();
        this.models = this.prepareModels();
        await this.sequelize.sync();

        debug("ready");
    }

    private prepareModels(): any {

        const chain = this.sequelize.define("chain", {
            blockindex: {
              type: Sequelize.INTEGER,
            },
            previoushash: {
                type: Sequelize.STRING,
            },
            proof: {
                type: Sequelize.INTEGER,
            },
            blocktimestamp: {
                type: Sequelize.DATE,
            },
            recipient: {
              type: Sequelize.STRING,
            },
            sender: {
                type: Sequelize.STRING,
            },
            payload: {
                type: Sequelize.STRING,
            },
            signature: {
                type: Sequelize.TEXT,
            },
            timestamp: {
                type: Sequelize.DATE,
            },
            amount: {
                type: Sequelize.INTEGER,
            },
          }, {
            timestamps: false,
            paranoid: false,
            underscored: true,
            freezeTableName: true,
            tableName: "chain",
            version: false,
            indexes: [
                {
                    unique: false,
                    fields: ["blockindex"],
                },
                {
                    unique: false,
                    fields: ["previoushash"],
                },
            ],
          });

        return {
            chain,
        };
    }

    public async storeBlock(block: BlockInterface): Promise<void> {

        debug("storing block with", block.transactions.length, "transactions");

        const operations = block.transactions.map((transaction) => {
            return this.models.chain.create({
                blockindex: block.index,
                previoushash: block.previousHash,
                proof: block.proof,
                blocktimestamp: block.timestamp,
                recipient: transaction.recipient,
                sender: transaction.sender,
                payload: transaction.payload,
                signature: transaction.signature,
                timestamp: transaction.timestamp,
                amount: transaction.amount,
            });
        });

        await Promise.all(operations);
    }

    public async getBlock(index: number): Promise<BlockInterface|null> {

        const rows: TransferInterface[] = await this.models.chain.findAll({
            where: {
                blockindex: index,
            },
        }).map((row) => row.get());

        if (!rows || !rows.length) {
            return null;
        }

        const transactions: TransactionInterface[] = rows.map((row) => {

            const transaction: TransactionInterface = {
                amount: row.amount,
                recipient: row.recipient,
                sender: row.recipient,
                payload: row.payload,
                signature: row.signature,
                timestamp: row.timestamp.valueOf(),
            };

            return transaction;
        });

        const block: BlockInterface = {
            index,
            previousHash: rows[0].previoushash,
            proof: rows[0].proof,
            timestamp: rows[0].blocktimestamp.valueOf(),
            transactions,
        };

        return block;
    }

    public async getTransactionsOfAddress(address: string): Promise<TransactionInterface[]> {

        const results = await this.models.chain.findAll({
            where: {
                [Op.or]: [{recipient: address}, {sender: address}],
            },
        });

        return results.map((result) => {

            const res = result.get();
            const transaction: TransactionInterface = {
                recipient: res.recipient,
                sender: res.sender,
                payload: res.payload,
                signature: res.signature,
                timestamp: res.timestamp,
                amount: res.amount,
            };

            return transaction;
        });
    }

    public async getBalanceOfAddress(address: string): Promise<number> {

        const transactions = await this.getTransactionsOfAddress(address);

        if (!transactions || !transactions.length) {
            return -1;
        }

        let balance = 0;
        transactions.forEach((transaction) => {
            if (transaction.recipient === address) {
                balance += transaction.amount;
            } else {
                balance -= transaction.amount;
            }
        });

        return balance;
    }

    public async replaceFullChain(blockchain: TransactionInterface[]): Promise<void> {
        // TODO: this should be changed into a chunk processing to scale
        await this.models.chain.truncate();
        await this.models.chain.bulkCreate(blockchain);
    }

    public getWholeChain(limit: number = 20): EventEmitter {

        const ee = new EventEmitter();
        let offset = 0;

        // simple recursive pagination wrapped via event emitter
        const batchWithLimit = async () => {

            const data = await this.models.chain.findAll({ offset, limit });

            if (!data || !data.length) {
                ee.emit("end");
                return;
            }

            data.forEach((row) => {
                ee.emit("row", row);
            });

            if (data.length < limit) {
                ee.emit("end");
                return;
            }

            offset += data.length;
            return batchWithLimit();
        };

        batchWithLimit().catch((error) => {
            ee.emit("error", error);
        });

        return ee;
    }

    public async getChainLength(): Promise<number> {
        return this.models.chain.count({
            col: "previoushash",
            distinct: true,
        });
    }

    public async getLastBlock(): Promise<BlockInterface|null> {

        const highestIndex = await this.models.chain.max("blockindex");

        if (!highestIndex && highestIndex !== 0) {
            return null;
        }

        return await this.getBlock(highestIndex);
    }

    public close(): void {
        debug("closing..");
        this.sequelize.close();
    }
}
