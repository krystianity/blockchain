import * as path from "path";

import * as Debug from "debug";
const debug = Debug("blockchain:index");

import App from "./lib/App";

const config = {
    advertisedHost: "http://localhost:1337",
    blockchain: {
        mintAddress: "0",
        mintReward: 100,
        difficulty: 4,
    },
    http: {
        port: 1337,
    },
    addressOpts: {
        bits: 1042,
        e: 65537,
    },
    database: {
        database: "blockchain",
        username: "root",
        password: "toor",
        storage: path.join(__dirname, "./../blockchain.sqlite"),
    },
};

const app = new App(config);

app.init().then(() => {
    debug("started");
}).catch((error) => {
    debug("failed to start", error.message);
});
