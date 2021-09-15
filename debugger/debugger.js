'use strict'

const http = require('http')
const querystring = require('querystring')

const bitcoin = require('bitcoinjs-lib')
const zmq = require("zeromq")
const RpcClient = require('bitcoind-rpc')
const redis = require('redis')
const Queue = require('bee-queue')

const APIHOST = process.env.APIHOST || 'api'
const APIPORT = process.env.APIPORT || '5000'

const HOST = process.env.ZMQNODE || "192.168.68.122"
const PORT = process.env.ZMQPORT || "29000"

const USER = process.env.RPCUSER || 'bitcoin'
const PASS = process.env.RPCPASS || 'local127'

const rpcConfig = {
    protocol: 'http',
    user: USER,
    pass: PASS,
    host: HOST,
    port:'8332'
}

const sock = new zmq.Subscriber
var rpc = new RpcClient(rpcConfig)

sock.connect("tcp://" + HOST + ":" + PORT)
sock.subscribe('rawtx');
sock.subscribe('rawblock')

const threshold = process.env.THRESHOLD || 10000000

const sharedConfig = {
    redis: redis.createClient(6379, 'redis'),
}

const monitorQueue = new Queue('monitor', sharedConfig)
monitorQueue
    .ready()
    .then(async (queue) => {
        console.log('isRunning:', queue.isRunning())
        const checkHealth = await queue.checkHealth();
        console.log('checkHealth:', checkHealth);
    })
    .catch((err) => console.log('unreadyable', err))


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
            try {
                const parsedData = JSON.parse(rawData)
                next(parsedData)
            } catch (e) {
                console.error(e.message)
            }
        })
    
    })
    
    request.on('error', (error) => {
        console.log(error.message)
    })
    
    request.end()
} 
    
monitorQueue.process(4, (job, done) => {
    rpc.decodeRawTransaction(job.data, async function(err, txDecoded) {
        if (err) {
            console.log('err', err)
        } else {
            const tx = txDecoded.result
            // console.log(JSON.stringify(tx, null, 2))

            const inputTxs = txDecoded.result.vin.map((x) => {
                return x.txid
            })

            let outputAddrs = [] 
            for (let i = 0; i < txDecoded.result.vout.length; i++) {
                if (txDecoded.result.vout[i].scriptPubKey.addresses != undefined) {
                    for (let a = 0; a < txDecoded.result.vout[i].scriptPubKey.addresses.length; a++) {
                        const addr = txDecoded.result.vout[i].scriptPubKey.addresses[a]
                        if (outputAddrs.indexOf(addr) == -1) outputAddrs.push(addr)
                    }
                }
                
            } 

            for (let i = 0; i < txDecoded.result.vout.length; i++) {
                if (txDecoded.result.vout[i].value >= threshold ) {
                    if (txDecoded.result.vout[i].scriptPubKey.addresses != undefined) {
                        for (let a = 0; a < txDecoded.result.vout[i].scriptPubKey.addresses.length; a++) {
                            (function(tx, i, a, inputTxs, outputAddrs) {
                                const query = {
                                    'type': 'deposit',
                                    'inputTxs': inputTxs.join(","),
                                    'outputAddrs': outputAddrs.join(","),
                                    'txid': tx.txid,
                                    'addr': tx.vout[i].scriptPubKey.addresses[a],
                                    'value': tx.vout[i].value
                                }

                                httpGet('/address/add', query, function(data) {
                                    // console.log(data)
                                })
                                
                                // because we are auto monitoring addresses here,
                                // I add the first transactions as well in the database
                                httpGet('/tx/add', query, function(data) {
                                    // console.log(data)
                                })

                            })(txDecoded.result, i, a, inputTxs, outputAddrs)
                        }
                    }
                }
            }
        }
        done()
    })
})

async function run() {
    for await (const [topic, message] of sock) {
        if (topic.toString() === 'rawtx') {
            const rawTx  = message.toString('hex')

            const job = await monitorQueue.createJob(rawTx)
            job.save((err, job) => {
                if (err) {
                    console.log(`Error saving job ${job.id}: ${err}`)
                }
            })
        }
    }
}

run()