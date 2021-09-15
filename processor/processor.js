'use strict'

const bitcoin = require('bitcoinjs-lib')
const zmq = require("zeromq")
const queue = require('./queue')

const HOST = process.env.ZMQNODE || "192.168.68.122"
const PORT = process.env.ZMQPORT || "29000"

const sock = new zmq.Subscriber

sock.connect("tcp://" + HOST + ":" + PORT)
sock.subscribe('rawtx');
sock.subscribe('rawblock')


async function run() {
    for await (const [topic, message] of sock) {
        if (topic.toString() === 'rawtx') {
            const rawTx  = message.toString('hex')

            queue.createJob(rawTx)    
            
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