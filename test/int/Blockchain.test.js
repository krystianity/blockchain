"use strict";

const assert = require("assert");

const HttpClient = require("./../../dist/lib/http/HttpClient.js").default;
const App = require("./../../dist/lib/App.js").default;
const {getNodeIdentifier} = require("./../../dist/lib/utils/index.js");

const config1 = {
    advertisedHost: "http://localhost:1337",
    blockchain: {
        difficulty: 4,
    },
    http: {
        port: 1337,
    },
};

const config2 = {
    advertisedHost: "http://localhost:1338",
    blockchain: {
        difficulty: 4,
    },
    http: {
        port: 1338,
    },
};

const config3 = {
    advertisedHost: "http://localhost:1339",
    blockchain: {
        difficulty: 4,
    },
    http: {
        port: 1339,
    },
};

describe("Blockchain INT", () => {

    const client = new HttpClient();

    let app = null;
    let app2 = null;
    let app3 = null;

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
            url: "http://localhost:1337/api/chain",
            method: "GET"
        });

        assert.equal(status, 200);
        assert.equal(body.chain[0].index, 1);
    });

    it("should be able to get chain 2 with first block", async () => {

        const {status, body} = await client.call({
            url: "http://localhost:1338/api/chain",
            method: "GET"
        });

        assert.equal(status, 200);
        assert.equal(body.chain[0].index, 1);
    });

    it("should be able to get chain 3 with first block", async () => {

        const {status, body} = await client.call({
            url: "http://localhost:1339/api/chain",
            method: "GET"
        });

        assert.equal(status, 200);
        assert.equal(body.chain[0].index, 1);
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

    it("should be able to create a new transaction on 1 node", async () => {

        const {status, body} = await client.call({
            url: "http://localhost:1337/api/transactions/new",
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                sender: getNodeIdentifier(),
                recipient: getNodeIdentifier(),
                amount: 1, 
                payload: {}
            })
        });

        assert.equal(status, 201);
    });

    it("should be able to create a new transaction on 2 node", async () => {

        const {status, body} = await client.call({
            url: "http://localhost:1338/api/transactions/new",
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                sender: getNodeIdentifier(),
                recipient: getNodeIdentifier(),
                amount: 1, 
                payload: {}
            })
        });

        assert.equal(status, 201);
    });

    it("should be able to create a new transaction on 3 node", async () => {

        const {status, body} = await client.call({
            url: "http://localhost:1339/api/transactions/new",
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                sender: getNodeIdentifier(),
                recipient: getNodeIdentifier(),
                amount: 1, 
                payload: {}
            })
        });

        assert.equal(status, 201);
    });

    it("should be able to mine blocks on all nodes", async () => {

        const calls = ["7", "8", "9"].map(ipEnd => {
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

    it("should be able to resolve conflicts", async () => {

        const calls = ["7", "8", "9"].map(ipEnd => {
            return client.call({
                url: `http://localhost:133${ipEnd}/api/nodes/resolve`,
                method: "GET"
            });
        });

        const results = await Promise.all(calls);

        results.forEach(result => {
            assert.equal(result.status, 200);
        });
    });
});
