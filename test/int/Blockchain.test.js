"use strict";

const assert = require("assert");
const path = require("path");

const HttpClient = require("./../../dist/lib/http/HttpClient.js").default;
const App = require("./../../dist/lib/App.js").default;
const {getNodeIdentifier} = require("./../../dist/lib/utils/index.js");

const config = {
    advertisedHost: "",
    blockchain: {
        mintAddress: "0",
        mintReward: 100,
        difficulty: 4,
        protocol: "http://",
    },
    http: {
        port: 8080,
    },
    addressOpts: {
        bits: 512,
        e: 65537,
    },
    database: {
        database: "blockchain_test",
        username: "root",
        password: "toor",
        storage: path.join(__dirname, "./../../dist/test.db"),
    },
};

const config1 = Object.assign({}, config, {
    advertisedHost: "http://localhost:1337",
    http: {
        port: 1337
    },
    database: {
        database: "blockchain_test",
        username: "root",
        password: "toor",
        storage: path.join(__dirname, "./../../dist/blockchain1.db"),
    },
});

const config2 = Object.assign({}, config, {
    advertisedHost: "http://localhost:1338",
    http: {
        port: 1338
    },
    database: {
        database: "blockchain_test",
        username: "root",
        password: "toor",
        storage: path.join(__dirname, "./../../dist/blockchain2.db"),
    },
});

const config3 = Object.assign({}, config, {
    advertisedHost: "http://localhost:1339",
    http: {
        port: 1339
    },
    database: {
        database: "blockchain_test",
        username: "root",
        password: "toor",
        storage: path.join(__dirname, "./../../dist/blockchain3.db"),
    },
});

const testName = "Blockchain INT " + (process.env.CONSENSUS_TEST ? "CONSENSUS" : "P2P");

describe(testName, () => {

    const client = new HttpClient();

    let app = null;
    let app2 = null;
    let app3 = null;
    let clientAddress1 = null;
    let clientAddress2 = null;

    before(async () => {

        app = new App(config1);
        app2 = new App(config2);
        app3 = new App(config3);

        await app.init();
        await app2.init();
        await app3.init();
    });

    after(() => {
        app.close();
        app2.close();
        app3.close();
    });

    it("should be able to get chain 1 with first block", async () => {

        const {status, body} = await client.call({
            url: "http://localhost:1337/api/peer/chain",
            method: "GET"
        });

        assert.equal(status, 200);
        assert.equal(body[0].blockindex, 1);
    });

    it("should be able to get chain 2 with first block", async () => {

        const {status, body} = await client.call({
            url: "http://localhost:1338/api/peer/chain",
            method: "GET"
        });

        assert.equal(status, 200);
        assert.equal(body[0].blockindex, 1);
    });

    it("should be able to get chain 3 with first block", async () => {

        const {status, body} = await client.call({
            url: "http://localhost:1339/api/peer/chain",
            method: "GET"
        });

        assert.equal(status, 200);
        assert.equal(body[0].blockindex, 1);
    });

    it("should be able to register nodes with themselves", async () => {

        await app.blockchain.registerSelfAtOtherNode("http://localhost:1338");
        await app.blockchain.registerSelfAtOtherNode("http://localhost:1339");

        await app2.blockchain.registerSelfAtOtherNode("http://localhost:1337");
        await app2.blockchain.registerSelfAtOtherNode("http://localhost:1339");

        await app3.blockchain.registerSelfAtOtherNode("http://localhost:1337");
        await app3.blockchain.registerSelfAtOtherNode("http://localhost:1338");

        assert.equal(app.blockchain.getNodesCount(), 2);
        assert.equal(app2.blockchain.getNodesCount(), 2);
        assert.equal(app3.blockchain.getNodesCount(), 2);
    });

    it("should be able to generate new address for client 1", async () => {

        const {status, body} = await client.call({
            url: "http://localhost:1337/api/address/new",
            method: "GET"
        });

        assert.equal(status, 200);
        clientAddress1 = body.address;
        assert.ok(clientAddress1.address);
        assert.ok(clientAddress1.privateKey);
    });

    it("should be able to generate new address for client 2", async () => {

        const {status, body} = await client.call({
            url: "http://localhost:1337/api/address/new",
            method: "GET"
        });

        assert.equal(status, 200);
        clientAddress2 = body.address;
        assert.ok(clientAddress2.address);
        assert.ok(clientAddress2.privateKey);
    });

    it("should be able to create a new transaction on 1 node", async () => {

        let transaction = {
            sender: clientAddress1.address,
            recipient: clientAddress2.address,
            amount: 1, 
            payload: "test 10313 0183 21803 1290301283 12931203019 23901209312809381203 123123 123123 15",
            signature: "",
            timestamp: Date.now()
        };

        let {status, body} = await client.call({
            url: "http://localhost:1337/api/transactions/sign",
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                transaction,
                address: clientAddress1.address,
                privateKey: clientAddress1.privateKey
            })
        });

        assert.equal(status, 200);
        transaction = body.transaction;
        assert.ok(transaction);

        let {status: status2, body: body2} = await client.call({
            url: "http://localhost:1337/api/transactions/new",
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(transaction)
        });

        assert.equal(status2, 201);
    });

    it("should be able to create a new transaction on 2 node", async () => {

        let transaction = {
            sender: clientAddress1.address,
            recipient: clientAddress2.address,
            amount: 1, 
            payload: "test",
            signature: "",
            timestamp: Date.now()
        };

        let {status, body} = await client.call({
            url: "http://localhost:1338/api/transactions/sign",
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                transaction,
                address: clientAddress1.address,
                privateKey: clientAddress1.privateKey
            })
        });

        assert.equal(status, 200);
        transaction = body.transaction;
        assert.ok(transaction);

        let {status: status2, body: body2} = await client.call({
            url: "http://localhost:1338/api/transactions/new",
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(transaction)
        });

        assert.equal(status2, 201);
    });

    it("should be able to create a new transaction on 3 node", async () => {

        let transaction = {
            sender: clientAddress1.address,
            recipient: clientAddress2.address,
            amount: 1, 
            payload: "test",
            signature: "",
            timestamp: Date.now()
        };

        let {status, body} = await client.call({
            url: "http://localhost:1339/api/transactions/sign",
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                transaction,
                address: clientAddress1.address,
                privateKey: clientAddress1.privateKey
            })
        });

        assert.equal(status, 200);
        transaction = body.transaction;
        assert.ok(transaction);

        let {status: status2, body: body2} = await client.call({
            url: "http://localhost:1339/api/transactions/new",
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(transaction)
        });

        assert.equal(status2, 201);
    });

    it("should be able to mine blocks on node:1", async () => {

        const calls = ["7"].map(ipEnd => {
            return client.call({
                url: `http://localhost:133${ipEnd}/api/mine`,
                method: "GET"
            });
        });

        const results = await Promise.all(calls);

        results.forEach(result => {
            assert.equal(result.status, 201);
            assert.ok(result.body.block);
        });
    });

    it("should await node:1 block publishing", done => {
        setTimeout(done, 1000);
    });

    it("should be able to mine blocks on node:2", async () => {

        const calls = ["8"].map(ipEnd => {
            return client.call({
                url: `http://localhost:133${ipEnd}/api/mine`,
                method: "GET"
            });
        });

        const results = await Promise.all(calls);

        results.forEach(result => {
            assert.equal(result.status, 201);
            assert.ok(result.body.block);
        });
    });

    it("should await node:2 block publishing", done => {
        setTimeout(done, 1000);
    });

    it("should be able to mine blocks on node:3", async () => {

        const calls = ["9"].map(ipEnd => {
            return client.call({
                url: `http://localhost:133${ipEnd}/api/mine`,
                method: "GET"
            });
        });

        const results = await Promise.all(calls);

        results.forEach(result => {
            assert.equal(result.status, 201);
            assert.ok(result.body.block);
        });
    });

    it("should await node:3 block publishing", done => {
        setTimeout(done, 1000);
    });

    it("should be able to create a new transaction on 1 node again", async () => {

        let transaction = {
            sender: clientAddress1.address,
            recipient: clientAddress2.address,
            amount: 1, 
            payload: "test",
            signature: "",
            timestamp: Date.now()
        };

        let {status, body} = await client.call({
            url: "http://localhost:1337/api/transactions/sign",
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                transaction,
                address: clientAddress1.address,
                privateKey: clientAddress1.privateKey
            })
        });

        assert.equal(status, 200);
        transaction = body.transaction;
        assert.ok(transaction);

        let {status: status2, body: body2} = await client.call({
            url: "http://localhost:1337/api/transactions/new",
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(transaction)
        });

        assert.equal(status2, 201);
    });

    it("should be able to mine another block on the first node", async () => {

        const calls = ["7"].map(ipEnd => {
            return client.call({
                url: `http://localhost:133${ipEnd}/api/mine`,
                method: "GET"
            });
        });

        const results = await Promise.all(calls);

        results.forEach(result => {
            assert.equal(result.status, 201);
            assert.ok(result.body.block);
        });
    });

    if(!process.env.CONSENSUS_TEST){
        it("should await node:1 second block publishing", done => {
            setTimeout(done, 1000);
        });
    }

    it("should be able to resolve conflicts node:1", async () => {

        const calls = ["7"].map(ipEnd => {
            return client.call({
                url: `http://localhost:133${ipEnd}/api/nodes/resolve`,
                method: "GET"
            });
        });

        const results = await Promise.all(calls);

        results.forEach(result => {
            assert.equal(result.status, 200);
        });

        assert.equal(await app.blockchain.getLength(), 5);
    });

    it("should be able to resolve conflicts node:2", async () => {

        const calls = ["8"].map(ipEnd => {
            return client.call({
                url: `http://localhost:133${ipEnd}/api/nodes/resolve`,
                method: "GET"
            });
        });

        const results = await Promise.all(calls);

        results.forEach(result => {
            assert.equal(result.status, 200);
        });

        assert.equal(await app2.blockchain.getLength(), 5);
    });

    it("should be able to resolve conflicts node:3", async () => {

        const calls = ["9"].map(ipEnd => {
            return client.call({
                url: `http://localhost:133${ipEnd}/api/nodes/resolve`,
                method: "GET"
            });
        });

        const results = await Promise.all(calls);

        results.forEach(result => {
            assert.equal(result.status, 200);
        });

        assert.equal(await app3.blockchain.getLength(), 5);
    });

    it("should be able to see equal balances on all nodes", async () => {

        const calls = ["7", "8", "9"].map(ipEnd => {
            return client.call({
                url: `http://localhost:133${ipEnd}/api/address/balance`,
                method: "POST",
                headers: {
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    address: clientAddress2.address
                })
            });
        });

        const results = await Promise.all(calls);

        results.forEach(result => {
            assert.equal(result.status, 200);
            assert.equal(result.body.balance, 4);
        });
    });

    it("should be able to see transactions for address", async () => {

        const {status, body} = await client.call({
            url: "http://localhost:1337/api/address/transactions",
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                address: clientAddress2.address
            })
        });

        assert.equal(status, 200);
        assert.equal(body.transactions.length, 4);
    });

    it("should be able to get last block", async () => {

        const {status, body} = await client.call({
            url: "http://localhost:1337/api/blocks/last",
            method: "GET"
        });

        assert.equal(status, 200);
        assert.ok(body.block);
    });
});
