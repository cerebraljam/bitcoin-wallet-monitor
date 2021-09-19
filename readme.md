# Bitcoin Wallet Monitor

## Why is this code useful?

I wanted to monitor for outgoing transactions from a bitcoin wallets.

A transaction looks like this: (see below for a full transaction)
* Transaction
    * vin: list of previous transactions
        * txid: transaction id from where coins are coming
    * vout: list of addresses (and other stuff)
        * addresses: address where the coins are being sent
        * value: how many coins are being stent to that address 
    * txid: transaction id

A transaction on the blockchain does not contain the source address of a transaction, it only refers to precedent transaction ids where the coins will come from. 
The sum of all the values from these txid will be distributed between all the outputs.

This means that...
> If I want to monitor outgoing transactions, I need to keep track of all transactions id used when coins were sent to a monitored address. 
> When there is a new transaction, I can lookup the inputs in my list of monitored txid associated with my addresses. If one match, then I know that the coins for the current transaction will be coming from one of the monitored address.

The bug is that I need to look at all the transactions to keep this state up to date. going offline risks missing incoming (deposit) or outgoing (withdraw) of coins

Note about capacity:
> This service isn't meant to monitor all transactions occuring on the blockchain for analysis later. if you want to do this, using the [public dataset on Bigquery](https://cloud.google.com/blog/topics/public-datasets/bitcoin-in-bigquery-blockchain-analytics-on-public-data) will be more useful.

## Quickstart

### Step 1: Configure
Configure the address of your full node in `./processor/Dockerfile` and `./debugger/Dockerfile`
```
ENV ZMQNODE=192.168.1.10
ENV RPCNODE=192.168.68.10
ENV RPCUSER=rpcuser
ENV RPCPASS=rpcpass
```

### Step 2: Enable/Disable the debugger
In the `docker-compose.yml` file, comment or uncomment the debugger section if you want to auto monitor addresses based on value.

If you enable or disable, be sure to configure the threshold in  `./debugger/Dockerfile` (1 == 1btc)
> ENV THRESHOLD=1

if you enable or disable, you will need to rebuild.
> docker-compose up --build

### Step 2: Start all the services
> docker-compose up


## Components

* api: api server
    Address
    * /address/add?addr=bitcoin_address Monitor an bitcoin address
    * /address/remove?addr=bitcoin_address Remove a monitored address
    * /address/exists?addr=bitcoin_address Check if an bitcoin_address is monitor
    * /address/list\[?addr=bitcoin_address\] List all addresses, or a specific address
    Transactions
    * /tx/add?type=\['deposit','withdraw'\]&addr=bitcoin_address&txid=transaction_id&value=\[>0.0000000001\]
    * /tx/remove?\[addr=bitcoin_address\]&\[txid=transaction_id\]
    * /tx/exists?\[addr=bitcoin_address\]&\[txid=transaction_id\]
    * /tx/list?\[addr=bitcoin_address\]&\[txid=transaction_id\]&\[type=\['deposit','withdraw'\]\]
* processor: monitoring service
    * connect on a full node using zmq to receive a feed of transactions
    * query the full node through rpc to recode transaction content
    * check if any inputs txid has been used for by a previously observed transaction: log it as a `withdraw`
    * check if any outputs contains an address that is being monitored: log it as a `deposit`
* debugger: used to automatically monitor
    * automatically monitoring for over THRESHOLD bitcoins (defined in Dockerfile)

# Config
* ./api/Dockerfile
    * PORT: can be used to change the port of the api server (hardcoded)
    * RPCNODE: ip of the full node with RPC enabled (optional)
    * RPCUSER: username configured in bitcoin.conf (optional)
    * RPCPASS: password configured in bitcoind.conf (optional)
    * APIHOST: host of the api server. default on 'api' if it's within the local docker server (optional)
    * APIPORT: port of the api server if it was changed (optional)
* ./processor/Dockerfile > this is where you configure the address of your bitcoind full node
    * ZMQNODE: ip address of the zeromq daemon, typically the full node
    * ZMQPORT: port of the zeromq daemon, 29000
* ./debugger
    * ZMQNODE: ip address of the zeromq daemon, typically the full node
    * ZMQPORT: port of the zeromq daemon, 29000

# Testing of The Api
```
cd api
npm test
```

# Query The Server
Note: there is no authentication. It is a bad idea to put it straight on the internet

> curl http://127.0.0.1:5000/tx/list|jq .
```
{
      "_id": "6141dfab6e4f4c7c9c04266a",
      "addr": "335umQ4egqMjD06wSxYwQZYPn7ZzMveNTJ",
      "txid": "1b054f485ea633162f20fcf4edbbf1123ec1bfe1772445f106be989a4670b971",
      "host": null,
      "inputTxs": [
        "ad2f93bf891c221347d82f9b24a7c8f5e945f53603bf1500ef753cd19c655c15"
      ],
      "outputAddrs": [
        "1HwApquq1q7ocm4Y6a2sruQKodzEURCwdq"
      ],
      "timestamp": "2021-09-15T11:57:31.346Z",
      "type": "withdraw",
      "value": 170.9995
    }
```


> curl http://127.0.0.1:5000/event/list|jq .
```
{
      "_id": "6141d0b559328c001e816d94",
      "timestamp": "2021-09-15T10:53:41.367Z",
      "table": "address",
      "action": "add",
      "host": "172.20.0.6",
      "addr": "bc1qm3dpme5mmfy2gnuvlx3zaew8psc9frr8vu7eyl",
      "txid": "a7630cc38721134d056090f8ee8139bb702bb38d2b9dd31d4d7a6d642807d9ee"
    }
```

# Content of One Transaction, As Decoded by the fullnode

```
debugger_1  | {
debugger_1  |   "txid": "004f5835b3cc334ede2e4c5065ba8531887f7bf857c05b239764faedee993838",
debugger_1  |   "hash": "69c95bc0ff8fc693086acc4753266588117464a98545d7b68f37bd67c6bae209",
debugger_1  |   "version": 2,
debugger_1  |   "size": 225,
debugger_1  |   "vsize": 144,
debugger_1  |   "weight": 573,
debugger_1  |   "locktime": 0,
debugger_1  |   "vin": [
debugger_1  |     {
debugger_1  |       "txid": "17790921bcb5f3a0ed518dfb06e67296ca7bb2b4263c66f6cfe243833e0eb272",
debugger_1  |       "vout": 7,
debugger_1  |       "scriptSig": {
debugger_1  |         "asm": "",
debugger_1  |         "hex": ""
debugger_1  |       },
debugger_1  |       "txinwitness": [
debugger_1  |         "304402204dfe357793bdcd38a2277a3c6d58cf107cdcbe3b1d2e04d94567c8676c1d747902204a53b707d39e3298f84bbcc81e478d2d42a41d84c13ad780d530146ba0d135ce01",
debugger_1  |         "02e1474abdf450b2e746de3d6c708f966966adf5ee20c1fb21997486d8545a7f0e"
debugger_1  |       ],
debugger_1  |       "sequence": 4294967295
debugger_1  |     }
debugger_1  |   ],
debugger_1  |   "vout": [
debugger_1  |     {
debugger_1  |       "value": 0.00272853,
debugger_1  |       "n": 0,
debugger_1  |       "scriptPubKey": {
debugger_1  |         "asm": "OP_DUP OP_HASH160 80d3f0c0ac86ba017f27cdf313b087137645fb2d OP_EQUALVERIFY OP_CHECKSIG",
debugger_1  |         "hex": "76a91480d3f0c0ac86ba017f27cdf313b087137645fb2d88ac",
debugger_1  |         "reqSigs": 1,
debugger_1  |         "type": "pubkeyhash",
debugger_1  |         "addresses": [
debugger_1  |           "1CkBPSBjVQzpQ6QAjC6QQnehupt5jpmYn7"
debugger_1  |         ]
debugger_1  |       }
debugger_1  |     },
debugger_1  |     {
debugger_1  |       "value": 0.00006081,
debugger_1  |       "n": 1,
debugger_1  |       "scriptPubKey": {
debugger_1  |         "asm": "0 ecb53d8368c8ff2f7ea1c84222f1e35fa4832a53",
debugger_1  |         "hex": "0014ecb53d8368c8ff2f7ea1c84222f1e35fa4832a53",
debugger_1  |         "reqSigs": 1,
debugger_1  |         "type": "witness_v0_keyhash",
debugger_1  |         "addresses": [
debugger_1  |           "bc1qaj6nmqmgerlj7l4peppz9u0rt7jgx2jnd9mypy"
debugger_1  |         ]
debugger_1  |       }
debugger_1  |     }
debugger_1  |   ]
debugger_1  | }
```

# Todo

* send logs to pubsub -> bigquery

