const bitcoin = require('bitcoinjs-lib');
const zmq = require('zeromq');
const fs = require('fs') 
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();
const sock = new zmq.Subscriber

const config = { // address of the full node with zeromq enabled
    host:'192.168.68.122',
    monitor: ['34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo'] 
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
    db.run(`CREATE TABLE IF NOT EXISTS tx(id INTEGER PRIMARY KEY AUTOINCREMENT, txid TEXT UNIQUE, address TEXT, value REAL)`, (err) => {
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
                    incomings.push({'address': y.script, 'value': y.value})
                }
                return y
            })

           
            // Step 1: check if the address is an address we care about
            // if yes, write the txid
            for (let i = 0; i < incomings.length; i++) {
		if (config['monitor'].indexOf(incomings[i]['address']) != -1) {
                    fs.appendFile('live_tx.json', JSON.stringify(tx) + '\n', function(err) {
                        if (err) return console.log(err)
		        console.log(incomings[i], tx.txid)
                    })
		    insert(tx, function() {
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
