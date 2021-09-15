const redis = require('redis')
const Queue = require('bee-queue')
const RpcClient = require('bitcoind-rpc')

const http = require('http')
const querystring = require('querystring')
const { assert } = require('console')

const HOST = process.env.RPCNODE || '192.168.68.122'
const USER = process.env.RPCUSER || 'bitcoin'
const PASS = process.env.RPCPASS || 'local127'
const APIHOST = process.env.APIHOST || 'api'
const APIPORT = process.env.APIPORT || '5000'


const rpcConfig = {
    protocol: 'http',
    user: USER,
    pass: PASS,
    host: HOST,
    port:'8332'
}

var rpc = new RpcClient(rpcConfig)

const sharedConfig = {
    redis: redis.createClient(6379, 'redis'),
}

const httpGet = function(path, query, next) {
    const options = {
        protocol: 'http:',
        host: APIHOST,
        port: APIPORT,
        path: path + '?' + querystring.stringify(query),
        headers : {
        'Content-Type': 'application/x-www-form-urlencoded'
        }
    }
    
    let rawData = ''
    
    const request = http.request(options, function(res) {
        res.setEncoding('utf8')
        res.on('data', (chunk) => { rawData += chunk; })
        
        res.on('end', () => {
            if (rawData != "") {
                try {
                    const parsedData = JSON.parse(rawData)
                    next(parsedData)
                } catch (e) {
                    console.log(rawData)
                    console.error('JSON.parse', e.message)
                }
            } else {
                next({})
            }
        })
    })
    
    request.on('error', (error) => {
        console.log(error.message)
    })
    
    request.end()
} 

const decodeQueue = new Queue('decode', sharedConfig)
decodeQueue
    .ready()
    .then(async (queue) => {
        console.log('isRunning:', queue.isRunning())
        const checkHealth = await queue.checkHealth();
        console.log('checkHealth:', checkHealth);
    })
    .catch((err) => console.log('unreadyable', err))


decodeQueue.on('error', (err) => {
    console.log(`A queue error happened: ${err.message}`)
});
    
/*decodeQueue.on('succeeded', (job, result) => {
    console.log(`Job ${job.id} succeeded with result: ${result}`)
})*/
    
decodeQueue.on('retrying', (job, err) => {
    console.log(
        `Job ${job.id} failed with error ${err.message} but is being retried!`
    )
})
    
decodeQueue.on('failed', (job, err) => {
    console.log(`Job ${job.id} failed with error ${err.message}`)
})
    
decodeQueue.on('stalled', (jobId) => {
    console.log(`Job ${jobId} stalled and will be reprocessed`)
})

const addRelevantSpending = function(tx, inputTxs, outputAddrs) {
    // step 1: is there any transaction referred in vin that is a tx of interest (txid in txlist, action='incoming')
    for (let i = 0; i < tx.vin.length; i++) {
        (function(tx, i, inputTxs, outputAddrs) {
            const query = {
                'txid': tx.vin[i].txid,
            }
            httpGet('/tx/list', query, function(data) {
                if (data.result.length >= 1) {
                    // in this case, this mean that we were monitoring addresses where this txid was used to receive value
                    let trashes = []
                    let multiples = []

                    for (let j = 0; j < data.result.length; j++) {
                        if (multiples.indexOf(data.result[j].addr) == -1) {
                            multiples.push(data.result[j].addr)
                            trashes.push(data.result[j])
                        }
                    }

                    for (let t = 0; t < trashes.length; t++) {
                        const query = {
                            'type': 'withdraw',
                            'inputTxs': inputTxs.join(","),
                            'outputAddrs': outputAddrs.join(","),
                            'txid': tx.txid,
                            'addr': trashes[t].addr,
                            'value': trashes[t].value
                        }
                        httpGet('/tx/add', query, function(data) {
                            // console.log('addRelevantSpending /tx/add', data)
                        })
                    }
                } 
            })
        })(tx, i, inputTxs, outputAddrs)
    }
}

const addRelevantIncommings = function(tx, inputTxs, outputAddrs) {
    for (let i = 0; i < tx.vout.length; i++) {
        if (tx.vout[i].scriptPubKey.addresses != undefined) {
            for (let a = 0; a < tx.vout[i].scriptPubKey.addresses.length; a++) {
                (function(tx, i, addr, inputTxs, outputAddrs) {
                    const query = {
                        'addr': addr
                    }
            
                    httpGet('/address/exists', query, function(data) {
                        if (data.result) {
                            const query = {
                                'action': 'deposit',
                                'inputTxs': inputTxs.join(","),
                                'outputAddrs': outputAddrs.join(","),
                                'txid': tx.txid,
                                'addr': addr,
                                'value': tx.vout[i].value
                            }

                            httpGet('/tx/add', query, function(data) {
                                // console.log('addRelevantIncommings /tx/add', data)
                            })
                        }
                    })
                })(tx, i, tx.vout[i].scriptPubKey.addresses[a], inputTxs, outputAddrs)
            }
        }
    }
}


decodeQueue.process(1, (job, done) => {
    rpc.decodeRawTransaction(job.data, async function(err, txDecoded) {
        if (err) {
            console.error('decodeQueue.process', err)
        } else {
            // console.log(JSON.stringify(txDecoded, null, 2))
  
            const tx = txDecoded.result

            const inputTxs = tx.vin.map((x) => {
                return x.txid
            })

            let outputAddrs = []
            let txSum = 0

            for (let i = 0; i < tx.vout.length; i++) {
                txSum+= tx.vout[i].value
                if (tx.vout[i].scriptPubKey.addresses != undefined) {
                    for (let a = 0; a < tx.vout[i].scriptPubKey.addresses.length; a++) {
                        const addr = tx.vout[i].scriptPubKey.addresses[a]
                        if (outputAddrs.indexOf(addr) == -1) outputAddrs.push(addr)
                    }
                }
                
            }

            addRelevantSpending(tx, inputTxs, outputAddrs)
            addRelevantIncommings(tx, inputTxs, outputAddrs)
        }
        done()
    })
})

const createJob = async function(data, next) {
    const job = await decodeQueue.createJob(data)
    job.save((err, job) => {
        if (err) {
            console.log(`Error saving job ${job.id}: ${err}`)
        }
    })
}

module.exports = {
    createJob: createJob
}