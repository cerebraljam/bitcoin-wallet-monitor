const bitcoin = require('bitcoinjs-lib');
const zmq = require('zeromq');
const fs = require('fs') 
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();
const sock = new zmq.Subscriber

const config = {
    host:'192.168.1.10', // address of the full node with zeromq enabled
    monitor: ['3QTUxAKmHqLAkvAjSvPxYoi5yUVRPQm2Cx', 'bc1qwfgdjyy95aay2686fn74h6a4nu9eev6np7q4fn204dkj3274frlqrskvx0', 'bc1qaw7e304esayf9ph9j5hn8uz6nwecudy6kvp2wu'],
    debug: true,
    automonitor: 1 * 100000000,
    debugminimum: 100 * 100000000
}
sock.connect("tcp://"+config['host']+":29000")
sock.subscribe('rawtx');
sock.subscribe('rawblock');

var db = new sqlite3.Database('wallet_watchlist.sqlite3', (err) => {
    if (err) {
        return console.error(err.message)
    }
})

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tx(id INTEGER PRIMARY KEY AUTOINCREMENT, txid TEXT, address TEXT, value NUMBER, created DATE, spent TEXT)`, (err) => {
        if (err) {
            return console.error('**', err.message)
        }

    })
    db.run(`CREATE INDEX IF NOT EXISTS idxt ON tx (txid)`)
    db.run(`CREATE INDEX IF NOT EXISTS idxa ON tx (address)`)
})

let sql = `SELECT * FROM tx WHERE txid = ?`

const insert = function(body, next) {
    let created = new Date().toISOString()
    let insert_stmt = db.prepare("INSERT OR IGNORE INTO tx(txid, address, value, created) VALUES (?, ?, ?, ?)")
    insert_stmt.run(body['txid'], body['address'], body['value'], created)
    //console.log('inserted', body['txid'], body['address'], body['value'], created)
    insert_stmt.finalize()
    next()
}

const update = function(txid, next) {
    let spent = new Date().toISOString()
    let update_stmt = db.prepare("UPDATE tx SET spent = ? WHERE txid = ?")
    update_stmt.run(spent, txid)
    console.log(new Date().toISOString(), 'updated', txid, spent)
    update_stmt.finalize()
    next()
}

const select = function(txids, next) {
    for (let i = 0; i < txids.length; i++) {
        let stmt = db.prepare('SELECT * FROM tx WHERE txid = ?')
        stmt.each(txids[i], function(err, row) {
            if (err) {
                console.log('barf', err)
            } else { 
                next(row)
            }
        }, function(err, count) {
            if (err) {
                console.log('puke', err)
            } else if (count > 0) {
                console.log(count)
            }
            stmt.finalize();
        });
    }


}
async function run() {
    for await (const [topic, message] of sock) {
        if (topic.toString() === 'rawtx') {
     	    let ins = []
            let outs = []

            var rawTx = message.toString('hex');
            var tx = bitcoin.Transaction.fromHex(rawTx);
            var txid = tx.getId();
            tx.txid = tx.getId()
            tx.ins = tx.ins.map(function(x) {
                x.hash = x.hash.toString('hex')
                x.script = x.script.toString('hex')
		        if (ins.indexOf(x.hash) == -1) {
                    //console.log('ins', x.hash.length, x.hash)
		            ins.push(x.hash)
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

                    //console.log('outs', tx.txid.length, tx.txid)
                    outs.push({'address': y.script, 'value': y.value, 'txid': tx.txid})
                }
                return y
            })

           
            // Step 1: check if the address is an address we care about
            // if yes, write the txid
            for (let i = 0; i < outs.length; i++) {
		        if (config['monitor'].indexOf(outs[i]['address']) != -1 || (config['debug'] && outs[i]['value'] >= config['automonitor'])) {
                    fs.appendFile('live_tx.json', JSON.stringify(tx) + '\n', function(err) {
                        if (err) return console.log(err)
                    })

		            insert(outs[i], function() {
			            if (config['debug'] && outs[i]['value'] >= config['debugminimum']) {
		                    console.log(new Date().toISOString(), outs[i]['address'], outs[i]['value']/100000000)
			            }
		            })
                    //ins.push(outs[i]['txid'])
	            }
            } 

	        // Step 2: check if any of the ins hash exists in our monitored transaction list
            select(ins, function(row) {
                console.log('found', row);
                fs.appendFile('outgoing_tx.json', JSON.stringify(tx) + '\n', function(err) {
                    if (err) return console.log(err)
                })
                update(ins[i], function(updated) {
                    db.get(sql, [ins[i]], (err, updated) => {
                       if (err) {
                           console.error(ins[i], err.message)
                           return false
                       } else {
                           console.log('* match', ins[i], updated)
                       }
                    })
                        
                })
            })
            /*
            for (let i = 0; i < ins.length; i++) {
	            db.get(sql, [ins[i]], (err, row) => {
                    if (err) {
                        console.error(ins[i], err.message)
                        return false
                    }

                    if (row != undefined) {
                        fs.appendFile('outgoing_tx.json', JSON.stringify(tx) + '\n', function(err) {
                            if (err) return console.log(err)
                        })
                        update(ins[i], function(updated) {
                            db.get(sql, [ins[i]], (err, updated) => {
                                if (err) {
                                    console.error(ins[i], err.message)
                                    return false
                                }
                                console.log('* match', ins[i], updated)
                            })
                        })
                    }
                })
            }*/
        } else if (topic.toString() === 'rawblock') {
            let rawBlk = message.toString('hex')
            let blk = bitcoin.Block.fromHex(rawBlk)
            console.log('+', new Date().toISOString(), blk.getId())
        } else {
            console.log('- not handled:', topic.toString())
        }
    }
}

run()
