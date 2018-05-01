# blockchain

PoW Blockchain implementation in TypeScript.

## Features/Setup

* Proof of Work __(similar to Bitcoin's Hashcash)__
* Consensus __(similar to Bitcoin's longest chain)__
* Node P2P communication via HTTP/S
* Addresses in RSA PEM 1024/2048 **easily swapable with e.g. elliptic curves**
* Transaction SHA256 signature validation
* Transactions with additional Payload field
* SHA256 Block Hashes
* All node operations are call-able via HTTP API
* Chain backed to disk via SQLite3 **easily swapable with a different backend**

## Description

TBD

## Use

### Prepare

`yarn`

### Start

`yarn start`

### Test

`yarn test`

## API

### Client Facing

* `GET /api/address/new` **blocking operation**
* `POST /api/address/transactions/:address - {address}`
* `POST /api/address/balance/:address - {address}`
* `GET /api/blocks/last`

* `POST /api/transaction/sign - {transaction, address, privateKey}` **test endpoint**
* `POST /api/transactions/new - {sender, recipient, amount, payload, timestamp, signature}`

### Operations (trigger)

* `GET /api/mine` **blocking operation**
* `GET /api/nodes/resolve`

### P2P Node Protocol

* `POST /api/nodes/register - {nodes}`
* `GET /api/peer/chain` **p2p node endpoint**
* `POST /api/peer/transaction - {transaction}` **p2p node endpoint**
* `POST /api/peer/block - {block}` **p2p node endpoint**

## License

Apache License 2.0

## Further Scaling Oppertunities

* During conflict resolvation the servering node streams TransferInterface to the
fetching client node, but currently the client node does not stream insert the
blockchain.
* Currently the blockchain validation function is based on a full in memory process,
to scale further this needs to either be chunked/streamed or based on a db process.
* The balance of a sender should be checked when a transaction is made and when
such a transaction is received by another node via peer communcation