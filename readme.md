# Bitcoin Wallet Monitor

## Quickstart

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

# query the server
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