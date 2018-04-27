import App from "./lib/App";

import * as Debug from "debug";
const debug = Debug("blockchain:index");

const config = {
    advertisedHost: "http://localhost:1337",
    blockchain: {
        difficulty: 4,
    },
    http: {
        port: 1337,
    },
};

const app = new App(config);

app.init().then(() => {
    debug("started");
}).catch((error) => {
    debug("failed to start", error.message);
});
