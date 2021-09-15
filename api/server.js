'use strict'

const inspect = require('util').inspect
const assert = require('assert')

const express = require('express')
const bodyParser = require('body-parser')

const db = require('./monitordb')

const PORT = process.env.PORT || 5000
const HOST = process.env.HOST || "0.0.0.0"

const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

const validTargets = ['address', 'tx', 'log']

const validActions = ['add', 'remove', 'list', 'exists', 'nukeThemAll']
const valueOptionals = ['list', 'nukeThemAll', 'exists', 'remove']
const validTables = ['address', 'tx', 'event']
const addrLogActivated = ['add', 'remove', 'nukeThemAll']
const txLogActivated = ['remove', 'nukeThemAll']

const requiredKeys = function(requireds, obj, optional) {
    let payload = {}
    let failing = false

    requireds.forEach(function(key) {
        if (obj[key] != undefined) {
            payload[key] = obj[key]
        } else {
            failing = true
        }
    })

    if (failing & !optional) return false
    return payload
}

const isValid = function(valids, value) {
    if (valids.indexOf(value) != -1) return value
    return false
}

app.get('/', (req, res) => {
	res.json({"timestamp": new Date().toISOString(), 'host': req.socket.remoteAddress})
})

app.get('/address/:action', function(req, res) {
    const target = 'address'
    const action = isValid(validActions, req.params.action)
    const payload = requiredKeys(['addr'], req.query, valueOptionals.indexOf(action) != -1)

    if (action != false & payload != false) {
        db[target][action](payload, (result) => {
            res.send({"target": target, "action": action, "payload": payload, "result": result})

            if (addrLogActivated.indexOf(action) != -1) {
                const logging = {
                    'timestamp': new Date(),
                    'table': target,
                    'action': action,
                    'host': req.socket.remoteAddress,
                    'addr': db.is.addr(req.query.addr),
                    'txid': db.is.tx(req.query.txid),
                }

                db.event.log(logging)
            }
        })    
    } else {
        res.send({'error': true})
    }
})

app.get('/tx/:action', function(req, res) {
    const target = 'tx'
    const action = isValid(validActions, req.params.action)
    const payload = requiredKeys(['addr', 'txid', 'value', 'type', 'inputTxs', 'outputAddrs'], req.query, valueOptionals.indexOf(action) != -1)
 
    if (action != false & payload != false) {
        db[target][action](payload, (result) => {
            res.send({"target": target, "action": action, "payload": payload, "result": result})
            if (txLogActivated.indexOf(action) != -1) {
                const logging = {
                    'timestamp': new Date(),
                    'table': target,
                    'action': action,
                    'host': req.socket.remoteAddress,
                    'addr': db.is.addr(req.query.addr),
                    'txid': db.is.tx(req.query.txid),
                }

                db.event.log(logging)
            }
        })
    } else {
        res.send({'error': true})
    }
})

app.get('/event/log', function(req, res) {
    const logging = {
        'timestamp': new Date(),
        'table': isValid(validTables, req.query.table),
        'action': isValid(validActions, req.query.action),
        'host': req.query.host ? req.query.host : false,
        'addr': db.is.addr(req.query.addr),
        'txid': db.is.tx(req.query.txid),
    }

    if (logging.table != false & logging.action != false & logging.host != false) {
        db.event.log(logging, (result) => {
            res.send({"event": 'log', 'payload': logging, "result": result})
        })

    } else {
        res.send({'error': true})
    }
})

app.get('/event/list', function(req, res) {
    const payload = requiredKeys(['table', 'action', 'host', 'addr', 'txid'], req.query, 1)

    db.event.list(payload, (result) => {
        res.send({"event": 'list', 'payload': payload, "result": result})
    })
})

app.get('/event/nukeThemAll', function(req, res) {

    db.event.nukeThemAll((result) => {
        res.send({"event": 'list', "result": result})
    })
})

const server = app.listen(PORT, HOST, function() {
	console.log(`Running on http://${HOST}:${PORT}`)
})
