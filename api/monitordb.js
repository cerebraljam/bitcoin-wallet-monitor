'use strict'

const assert = require('assert')
const MongoClient = require('mongodb').MongoClient

const MONGOURL = "mongodb://mongo:27017/"
const DBNAME = "monitordb"

const addrContext = "watchlist"
const txContext = "txlist"
const logContext = "log"

var db = false

const isAddr = function(value) {
    const garbage = /[^a-z0-9]/gi // if there are any characters than alpha and numbers
    if (value != undefined) {
        if (!value.match(garbage)) {
            // I am being sloppy here. searching online gives conflicting numbers about the address length. 
            // it should be 42 or 62
            if (25 <= value.length & value.length < 70) { 
                return value
            }
        }
    }
    return false
}
const isTx = isAddr

const areAddrs = function(list) {
    let addrs = []
    for (let i=0; i < list.length; i++) {
        const a = isAddr(list[i])
        if (a) addrs.push(a)
    }
    return addrs
}
const areTxs = areAddrs

MongoClient.connect(MONGOURL, function(err, client) {
    if (err) {
        console.error('mongodb:', err)
    } else {
        console.log("Connected successfully to database")
        db = client.db(DBNAME)
    }
})

const addrAdd = function(payload, next) {
    const collection = db.collection(addrContext)

    if (isAddr(payload.addr) != false) {
        const update = {
            $set: { 
                timestamp: new Date(),
                addr: payload.addr
            }
        }
        collection.updateOne(payload, update, {upsert:true}, function(err, result) {
            if (err) console.error('addrAdd:', err)

            next(result.result.n)
        })
    } else {
        next(0)
    }
}

const addrRemove = function(payload, next) {
    const collection = db.collection(addrContext)

    if (isAddr(payload.addr) != false) {
        let query = {'addr': payload.addr}

        collection.deleteOne(query, function(err, result) {
            if (err) console.error('addrRemove:', err)
            next(result.result.n)
        })
    } else {
        next(0)
    }    	
}

const addrList = function(payload, next) {
    const collection = db.collection(addrContext)

    let query = {}
    if (isAddr(payload.addr) != false) query.addr = payload.addr

	collection.find(query).toArray(function(err, result) {
		if (err) console.error('addrList:', err)
		next(result)
        
	})
}

const addrExists = function(payload, next) {
    const collection = db.collection(addrContext)

    if (isAddr(payload.addr) != false) {
        const query = {
            "addr": payload.addr
        }

        collection.countDocuments(query, function(err, result) {
            if (err) console.error('addrExists:', err)
            next(result ? true : false)   
        })
    } else {
        next(false)
    }
}

const addrNuke = function(payload, next) {
    const collection = db.collection(addrContext)

    collection.deleteMany({}, function(err, result) {
        if (err) console.error('addrNuke:', err)
        next(result.result.n)
    })
}


const txAdd = function(payload, next) {
    const collection = db.collection(txContext)

    if (isAddr(payload.addr) != false & isTx(payload.txid) != false) {
        const query = {
            "addr": payload.addr,
            "txid": payload.txid
        }
    
        const update = {
            $set: { 
                timestamp: new Date(),
                type: payload.type,
                inputTxs: areTxs(payload.inputTxs.split(",")),
                outputAddrs: areAddrs(payload.outputAddrs.split(",")),
                addr: payload.addr,
                txid: payload.txid,
                value: parseFloat(payload.value),
                host: payload.host
            }
        }
        
        collection.updateOne(query, update, {upsert:true}, function(err, result) {
            if (err) console.error('txAdd:', err)
            next(result.result.n)
        })

    } else {
        next(0)
    }
    

}

const txRemove = function(payload, next) {
    const collection = db.collection(txContext)

    if (payload.addr != undefined || payload.txid != undefined) {
        let query = {}

        if (payload.addr) query.addr = payload.addr
        if (payload.txid) query.txid = payload.txid

        collection.deleteOne(query, function(err, result) {
            if (err) console.error('txRemove:', err)
            next(result.result.n)
        })
    } else {
        next(0)
    }
}

const txList = function(payload, next) {
    const collection = db.collection(txContext)

    let query = {}
    if (payload.addr != undefined) query.addr = payload.addr
    if (payload.txid != undefined) query.txid = payload.txid
    if (payload.action != undefined) query.action = payload.action

	collection.find(query).toArray(function(err, result) {
		if (err) console.error('txList:', err)
		next(result)
	})

}

const txExists = function(payload, next) {
    const collection = db.collection(txContext)

    let query = payload
    query.type = 'deposit'

	collection.countDocuments(payload, function(err, result) {
        if (err) console.error('txExists:', err)
        next(result ? true : false)   
    })
}


const txNuke = function(payload, next) {
    const collection = db.collection(txContext)
    collection.deleteMany({}, function(err, result) {
        if (err) console.error('txNuke:', err)
        next(result.result.n)
    })

}

const eventLog = function(logging, next) {
    const collection = db.collection(logContext)
    
    collection.insertOne(logging, function(err, result) {
        if (err) console.error('eventLog:', err)
        assert.strictEqual(result.result.n, 1)
        if (next != undefined) {
            next(result.result.n)
        }
    })
}

const eventList = function(payload, next) {
    const collection = db.collection(logContext)
    
	collection.find(payload).toArray(function(err, result) {
		if (err) console.error('eventList:', err)
		next(result)
	})
}

const logNuke = function(next) {
    const collection = db.collection(logContext)
    collection.deleteMany({}, function(err, result) {
        if (err) console.error('logNuke:', err)
        next(result.result.n)
    })

}

module.exports = {
    address: {
        add: addrAdd,
        remove: addrRemove,
        list: addrList,
        exists: addrExists,
        nukeThemAll: addrNuke

    },
    tx: {
        add: txAdd,
        remove: txRemove,
        list: txList,
        exists: txExists,
        nukeThemAll: txNuke
    },
    event: {
        log: eventLog,
        list: eventList,
        nukeThemAll: logNuke
    },
    is: {
        addr: isAddr,
        tx: isTx
    }

}