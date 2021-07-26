const bitcoin = require('bitcoinjs-lib');
const zmq = require('zeromq');
const fs = require('fs') 
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();
const sock = new zmq.Subscriber

const config = { // address of the full node with zeromq enabled
    host:'192.168.68.122',
    monitor: ['34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo', '16ftSEQ4ctQFDtVZiUBusQUjRrGhM3JYwe', '3e73540f1886b61adee15a93fa4d587d010cb674799f0ed3fae8399e63729a4e', '516a8b6f66318e068f7ae74717f068203dc042e9b6b963fc5fb5517be9d62a6a', '91f7b7cdfb8ccf5515b5cc9553d38a0f4853d7c996b27e4fa6c0212015eea1db', 'afa4f0ddf32d35a07a66990af7c032f1ab5eaf1b32bbb5853a9d1bf38f62d3d9', '3cacdbed263fabb6e3c50e340f72ec4a35a630e21c500179f97a5ddd22085d30', 'b0e8ea1410a6ce92574d6f17148c5af59c76ce457d2f246a0592d2a946734bb3', '3f807bd1af20ff3515ef3a3aa5a91f39ac3191f1d669e018d34397af5a5d8f3c', 'eeb0c166192f64e14c5328858ce0019888281f69fdc8cb7dc9b11625d60f4ba6', 'ca560195d255d8431a70871706084b692733b0c6e70551d80b321850924eb220'],
    automonitor: 300000000
}
sock.connect("tcp://"+config['host']+":29000")
sock.subscribe('rawtx');
sock.subscribe('rawblock');

var db = new sqlite3.Database('wallet_watchlist.sqlite3', (err) => {
    if (err) {
        return console.error(err.message)
    }
    console.log('Connected to the database')
})

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tx(id INTEGER PRIMARY KEY AUTOINCREMENT, txid TEXT UNIQUE, address TEXT, value NUMBER)`, (err) => {
        if (err) {
            return console.error('**', err.message)
        }

    })
    db.run(`CREATE INDEX IF NOT EXISTS idxt ON tx (txid)`)
    db.run(`CREATE INDEX IF NOT EXISTS idxa ON tx (address)`)
})

let sql = `SELECT * FROM tx WHERE txid = ?`

const insert = function(body, next) {
    let insert_stmt = db.prepare("INSERT OR IGNORE INTO tx(txid, address, value) VALUES (?, ?, ?)")
    console.log(body)
    insert_stmt.run(body['txid'], body['address'], body['value'])
    insert_stmt.finalize()
    next()

}

async function run() {
    for await (const [topic, message] of sock) {
    
        if (topic.toString() === 'rawtx') {
            let incomings = []
	    let sources = []

            var rawTx = message.toString('hex');
            var tx = bitcoin.Transaction.fromHex(rawTx);
            var txid = tx.getId();
            tx.txid = tx.getId()
            tx.ins = tx.ins.map(function(x) {
                x.hash = x.hash.toString('hex')
                x.script = x.script.toString('hex')
		if (sources.indexOf(x.hash) == -1) {
		    sources.push(x.hash)
		}
                return x

            })
            tx.outs = tx.outs.map(function(y) {
                if (y.script != undefined) {
                    try {
                        y.script = bitcoin.address.fromOutputScript(y.script, bitcoin.networks.bitcoin);
                    } catch (e) {
                        y.script = y.script.toString('hex')
                        y.error = true
                    }
                    incomings.push({'address': y.script, 'value': y.value, 'txid': tx.txid})
                }
                return y
            })

           
            // Step 1: check if the address is an address we care about
            // if yes, write the txid
            for (let i = 0; i < incomings.length; i++) {
		if (config['monitor'].indexOf(incomings[i]['address']) != -1 || incomings[i]['value'] >= config['automonitor']) {
                    fs.appendFile('live_tx.json', JSON.stringify(tx) + '\n', function(err) {
                        if (err) return console.log(err)
                    })

		    insert(incomings[i], function() {
		        //console.log(incomings[i])
		    })
	        }
            } 
	    // Step 2: check if any of the ins hash exists in our monitored transaction list
	   for (let i = 0; i < sources.length; i++) {
	       db.get(sql, [sources[i]], (err, row) => {
                   if (err) {
                       console.error(sources[i], err.message)
                       return false
                   }
                   if (row != undefined) {
                        fs.appendFile('outgoing_tx.json', JSON.stringify(tx) + '\n', function(err) {
                            if (err) return console.log(err)
                        })
                       console.log('* match', soures[i], row)
                   }
               })
           }
        } else {
            if (topic.toString() === 'rawblock') {
                let rawBlk = message.toString('hex')
                let blk = bitcoin.Block.fromHex(rawBlk)
                console.log(blk.getId())
            }
        }
    }
}

run()
