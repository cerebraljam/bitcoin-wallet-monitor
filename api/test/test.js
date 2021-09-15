var assert = require('assert')

const http = require('http')
const querystring = require('querystring')

const APIHOST = '127.0.0.1'
const APIPORT = '5000'
const TESTADDR = 'bc1testaddrgerlj7l4peppz9u0rt7jgx2jnd9mypy'
const TESTTX = '00dsttx5b3cc334ede2e4c5065ba8531887f7bf857c05b239764faedee993838'
const TESTSOURCETX = ['17srctx1bcb5f3a0ed518dfb06e67296ca7bb2b4263c66f6cfe243833e0eb272']


const httpGet = async function(path, query, next) {
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

describe('monitordb', function() {
  describe('address', function() {
    describe('add', function() {

      it('should have added an address', function(done) {
        const query = {
          'addr': TESTADDR
        }

        httpGet('/address/add', query, function(data) {
          assert.strictEqual(data.result, 1)
          done()
        })
  
      }) 
    })
  
    describe('exists', function() {

      it('should return a success when querying for an existing address', function(done) {
        const query = {
          'addr': TESTADDR
        }

        httpGet('/address/exists', query, function(data) {
          assert.strictEqual(data.result, true)
          done()
        })
      }) 
      it('should return a failure when querying for an unexisting address', function(done) {
        const query = {
          'addr': TESTADDR + 'junk'
        }

        httpGet('/address/exists', query, function(data) {
          assert.strictEqual(data.result, false)
          done()
        })
      }) 
    })
  
    describe('list', function() {

      it('should list the specific address we added', function(done) {
        const query = {
          'addr': TESTADDR
        }

        httpGet('/address/list', query, function(data) {
          assert.strictEqual(data.result.length, 1)
          done()
        })
      })

      it('should list at least 1 address if we ask to list all', function(done) {
        const query = {}

        httpGet('/address/list', query, function(data) {
          assert.strictEqual(data.result.length >= 1 ? true : false, true)
          done()
        })
      })
    })
  
    describe('remove', function() {

      it('should not remove any address if no address is specified', function(done) {
        const query = {}

        httpGet('/address/remove', query, function(data) {
          assert.strictEqual(data.result, 0)
          done()
        })
      })

      it('should return that 1 address was removed', function(done) {
        const query = {
          'addr': TESTADDR
        }

        httpGet('/address/remove', query, function(data) {
          assert.strictEqual(data.result, 1)
          done()
        })
      })
      
      it('should return that the address does not exist after removing it', function(done) {
        const query = {
          'addr': TESTADDR
        }

        httpGet('/address/exists', query, function(data) {
          assert.strictEqual(data.result, false)
          done()
        })
      })
    })
  })
  
  describe('tx', function() {
    describe('add', function() {
      it('should refuse to add a transaction if we only provide the address', function(done) {
        const query = {
          'addr': TESTADDR,
          'value': 3
        }

        httpGet('/tx/add', query, function(data) {
          assert.strictEqual(data.error, true)
          done()
        })
      })

      it('should refuse to add a transaction if we only provide the transaction id', function(done) {
        const query = {
          'txid': TESTTX,
          'value': 3
        }

        httpGet('/tx/add', query, function(data) {
          assert.strictEqual(data.error, true)
          done()
        })
      })

      it('should refuse to add a transaction if we ommit the value', function(done) {
        const query = {
          'addr': TESTADDR,
          'txid': TESTTX
        }

        httpGet('/tx/add', query, function(data) {
          assert.strictEqual(data.error, true)
          done()
        })
      })

      it('should accept to add a transaction if all parameters are provided', function(done) {
        const query = {
          "type": "deposit",
          "inputTxs": TESTSOURCETX.join(","),
          "outputAddrs": [TESTADDR].join(","),
          "txid": TESTTX,
          "value": 5,
          "addr": TESTADDR,    
        }

        httpGet('/tx/add', query, function(data) {
          assert.strictEqual(data.result, 1)
          done()
        })
      }) 
    })

    describe('exists', function() {
      it('should return true if we search for an existing address', function(done) {
        const query = {
          'addr': TESTADDR
        }

        httpGet('/tx/exists', query, function(data) {
          assert.strictEqual(data.result, true)
          done()
        })
      }) 

      it('should return false if we search for an unexisting address', function(done) {
        const query = {
          'addr': TESTADDR + 'junk'
        }

        httpGet('/tx/exists', query, function(data) {
          assert.strictEqual(data.result, false)
          done()
        })
      })

      it('should return true if we search for an existing transaction', function(done) {
        const query = {
          'txid': TESTTX
        }

        httpGet('/tx/exists', query, function(data) {
          assert.strictEqual(data.result, true)
          done()
        })
      }) 

      it('should return false if we search for an unexisting transaction', function(done) {
        const query = {
          'txid': TESTTX + 'junk'
        }

        httpGet('/tx/exists', query, function(data) {
          assert.strictEqual(data.result, false)
          done()
        })
      })
    })

    describe('list', function() {

      it('should list the transaction for the address we provided', function(done) {
        const query = {
          'addr': TESTADDR
        }

        httpGet('/tx/list', query, function(data) {
          assert.strictEqual(data.result.length, 1)
          done()
        })
      })

      it('should list the transaction for the address we provided', function(done) {
        const query = {
          'txid': TESTTX
        }

        httpGet('/tx/list', query, function(data) {
          assert.strictEqual(data.result.length, 1)
          // console.log(data)
          done()
        })
      })

      it('should list zero transaction if we ask for a wrong address', function(done) {
        const query = {
          'addr': TESTADDR + 'junk'
        }

        httpGet('/tx/list', query, function(data) {
          assert.strictEqual(data.result.length, 0)
          done()
        })
      })

      it('should list zero transaction if we ask for a wrong transaction id', function(done) {
        const query = {
          'txid': TESTTX + 'junk'
        }

        httpGet('/tx/list', query, function(data) {
          assert.strictEqual(data.result.length, 0)
          done()
        })
      })

    })


    describe('remove', function() {

      it('should not remove any transaction if no address is specified', function(done) {
        const query = {}
        

        httpGet('/tx/remove', query, function(data) {
          assert.strictEqual(data.result, 0)
          done()
        })
      })

      it('should return that one address was removed', function(done) {
        const query = {
          'txid': TESTTX
        }

        httpGet('/tx/remove', query, function(data) {
          assert.strictEqual(data.result, 1)
          done()
        })
      })

      it('should return false if we search for the address we deleted', function(done) {
        const query = {
          'addr': TESTADDR
        }

        httpGet('/tx/exists', query, function(data) {
          assert.strictEqual(data.result, false)
          done()
        })
      }) 

      it('should return false if we search for the transaction id we deleted', function(done) {
        const query = {
          'txid': TESTTX
        }

        httpGet('/tx/exists', query, function(data) {
          assert.strictEqual(data.result, false)
          done()
        })
      }) 
    })
  })

  describe('event', function() {
    it('should save an address log if all keys are provided', function(done) {
      const query = {
        'table': 'address',
        'action': 'add',
        'addr': TESTADDR,
        'host': '192.168.240.30'
      }

      httpGet('/event/log', query, function(data) {
        assert.strictEqual(data.result, 1)
        done()
      })
    })

    it('should allow to log a tx/add if all keys are provided. internally it wouldnt log', function(done) {
      const query = {
        'table': 'tx',
        'action': 'add',
        'addr': TESTADDR,
        'txid': TESTTX,
        'host': '192.168.240.30'
      }

      httpGet('/event/log', query, function(data) {
        assert.strictEqual(data.result, 1)
        done()
      })
    })

    it('should refuse a log if the action is not valid', function(done) {
      const query = {
        'table': 'tx',
        'action': 'junk',
        'addr': TESTADDR,
        'txid': TESTTX,
        'host': '192.168.240.30'
      }

      httpGet('/event/log', query, function(data) {
        assert.strictEqual(data.error, true)
        done()
      })
    })

    it('should return all logs if not parameters are provided', function(done) {
      const query = {}
  
      httpGet('/event/list', query, function(data) {
        assert.strictEqual(data.result.length > 0, true)
        done()
      })
    })

    it('should return at least one log entry if we query to see address/add for TESTADDR', function(done) {
      const query = {
        'action': 'add',
        'addr': TESTADDR
      }
  
      httpGet('/event/list', query, function(data) {
        assert.strictEqual(data.result.length > 0, true)
        done()
      })
    })
  })  
})
