const cron = require('node-cron')
const fetch = require('node-fetch')
var Airtable = require('airtable');

const BASE_ID = '' //<-- your Airtable base Id
const API_KEY = '' //<-- your Airtable api key

var base = new Airtable({ apiKey: API_KEY }).base(BASE_ID)

// call this script with:
// BREEDER={breeder} yarn mint
const BCD_URL = `https://api.better-call.dev/v1/account/mainnet/`
const TZKT_URL = `https://api.tzkt.io/v1/accounts/`


const QUERY_URL = `https://api.tzkt.io/v1/accounts/KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton/operations?sort=1&limit=1000&status=applied`
const BURN_CONTRACT = 'tz1burnburnburnburnburnburnburjAYjjX'

const offset = 0

const TOKEN_ID = '' // the token id for the burned token on H=N

// this method is passed into the batching function to handle writing a record
async function addRecords (records) {
  console.log('adding...', records)
  return new Promise((resolve, reject) => {
    base('Breeding Table').create(records, function(err, records) {
      if (err) reject(err)
      if (records && records.length > 0) {
        const r = [ ...records ]
        r.forEach((record) =>{
          const { BreederName, BreederTZ, BurnTxnID, BurnCounter } = record.fields
          console.log(`New fish! : Breeder ${BreederName} ${BreederTZ} - Hash ${BurnTxnID} : ${BurnCounter}`)
        })
      }
      resolve(records)
    })
  })
}

// airtable can't write more than 10 records at a time, this batches writing the data
async function batchChangesInSets (arrData, func) {
  if (arrData.length > 0) {
    // break added up into sets of 10 & update
    const addAll = [ ...arrData ]
    while(addAll.length > 0) {
      const toAdd = []
      for(let i=0; i< ((addAll.length > 10) ? 10 : addAll.length); i++) {
        toAdd.push(addAll.shift())
      }
      const results = await func(toAdd)
      console.log('added', results)
    }
  }
}

function checkBurnContracts (burnHistory) {
  console.log('Checking burn contracts ', new Date().toDateString(), new Date().toTimeString())
  // needs to go back in time to the last stored query recorded
  fetch(`${QUERY_URL}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => res.json())
  .then(data => {
    // filter the data-set 
    const burned = data
      // filter out the burn contract calls
      .filter(row => {
        return row.parameters.match(/tz1burnburnburnburnburnburnburjAYjjX/g) !== null
      })
      .filter(row => {
        // skip any failed transactions
        if (row.status != 'applied') return false 
        // filter by the token id
        return row.parameter.value[0].txs[0].token_id == TOKEN_ID
      })
      .filter(txn => !burnHistory.includes(txn.hash))
      .map(txn => {
        // check the txn parameters - just in case the sender has burned more than one token
        const { id, level, timestamp, hash, sender, parameters } = txn
        const params = JSON.parse(parameters)
        // this looks inside the burn contract to get the quantity
        const count = parseInt(params.value[0].args[1][0].args[1].args[1].int)
        //console.log(JSON.stringify(params))


        // these are the fields I needed - change to whatever you're storing about the transaction
        return {
          TransactionID: id, // store the transaction ID - we can use this later if we need to find all transations which have happened since
          TransactionLevel: level,
          BurnTxnID: hash,
          BreederTZ: sender.address,
          BreederName: sender.alias || '',
          DOB: timestamp,
          Status: 'pending',
          count
        }
      })

      // now create records for the burns we don't already know about
      const fieldData = burned
        .reduce((prev, current) => {
          if (current.count === 1) prev.push(current)
          else {
            const records = []
            for (let i=0; i< current.count; i++) {
              records.push({ ...current, BurnCounter: i })
            }
            prev = [ ...prev, ...records ]
          }
          return prev
        }, [])
        // remove count
        .map(({ TransactionID, TransactionLevel, BurnTxnID, BreederTZ, BreederName, DOB, Status, BurnCounter }) => { 
          if (!BurnCounter) BurnCounter = 0
          return {
            fields: { TransactionID, TransactionLevel, BurnTxnID, BreederTZ, BreederName, DOB, Status, BurnCounter } 
          }
        })
        // the data came in backwards, so reverse before saving so IDs are correct
        .reverse()


      // if there's data - write it to the correct table
      if (fieldData.length > 0) {
        try {
          console.log('batching')
          await batchChangesInSets(fieldData, addRecords)
        } catch(err) {
          console.log('ERROR!', err)
        }
      } else {
        console.log('No new records to add')
      }
  })
}


console.log('Started fishies burn contract observer')

// schedule the job to run every minute - change the cron expression to whatever's relevant to you
cron.schedule('* * * * *', () => {
  
  const burnHistory = []

  // not done anything with this bit yet - I will update it so that it checks the discrepency of unfetched rows from the last known row
  base('Breeding Table').select({
    // get the last record
    maxRecords: 1000,
    view: "Grid view"
  }).eachPage((records, fetchNextPage) => {
    // This function (`page`) will get called for each page of records.
    
    
    records.forEach((record) => {
      burnHistory.push(record.fields.BurnTxnID)
    });
    
    checkBurnContracts(burnHistory)

    // To fetch the next page of records, call `fetchNextPage`.
    // If there are more records, `page` will get called again.
    // If there are no more records, `done` will get called.
    // fetchNextPage();

  }, function done(err) {
    console.log(`that's all folks!`)
    if (err) { console.error(err); return; }
  });
})
