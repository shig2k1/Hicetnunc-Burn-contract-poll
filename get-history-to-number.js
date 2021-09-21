const fetch = require('node-fetch')

var Airtable = require('airtable');

// go back in time until the desired transaction hash is found

const QUERY_URL = `https://api.tzkt.io/v1/accounts/KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton/operations?sort=1&limit=1000&status=applied`
const TOKEN_ID = '81257' // the token id for the burned token on H=N

// the following values should probably be in environment variables
const BASE_ID = '' // your airtable baseid
const API_KEY = '' // your airtable api key

var base = new Airtable({ apiKey: API_KEY }).base(BASE_ID)

let level = 0


// this function adds records to the data store - in this case I have it set up for the columsn of data I need to know about fish token burns
// you could change these to whatever is relevant to you
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

const newBurns = [] // array to hold new burn information

async function getTransactions (burnHistory) {
  const query = level === 0 ? `` : `&level.le=${level}`
  fetch(`${QUERY_URL}${query}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => res.json())
  .then(async data => {
    // iterate over every item - return true if found the last known item
    const found = data
      // filter out the burn contract calls
      .filter(row => {
        return row.parameters.match(/tz1burnburnburnburnburnburnburjAYjjX/g) !== null
      })
      .reduce((prev, curr) => {
        if (!!prev) return prev// don't go deeper than known item
        //console.log(curr)
        if (curr.parameter?.value[0]?.txs[0].token_id == TOKEN_ID) newBurns.push(curr)
        if (curr.id === lastKnownTransaction) return true
        return prev
      }, false)
    // if is a burn of our token, add to array

    if (!found) {
      console.log('not found last known transaction - going deeper', level)

      level = data[data.length - 1].level
      return getTransactions(burnHistory)
    } else {
      // get the new data out - ensuring it hasn't somehow collided with old data
      const fieldData = newBurns
        .filter(txn => !burnHistory.includes(txn.hash))
        .map(txn => {
          // check the txn parameters - just in case the sender has burned more than one token
          const { id, level, timestamp, hash, sender, parameters } = txn
          const params = JSON.parse(parameters)
          // this looks inside the burn contract to get the quantity
          const count = parseInt(params.value[0].args[1][0].args[1].args[1].int)
          //console.log(JSON.stringify(params))

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
      
        if (fieldData.length > 0) {
          try {
            console.log('batching')
            await batchChangesInSets(fieldData, addRecords)
          } catch(err) {
            console.log('ERROR!', err)
          }
        }
      }
  })
}


const burnHistory = []
let lastKnownTransaction

// the script starts by fetching all the previously known burns from the data store - this ensures that burn transaction data isn't recorded twice
// it records the last transaction it saw as "lastKnownTransaction"

// IF THIS IS THE FIRST TIME YOU'VE EVER RUN THIS, YOU'LL PROBABLY WANT TO SET A DEFINITIVE VALUE FOR LAST KNOWN TRANSACTION, BECAUSE OTHERWISE
// IT'LL JUST RUN UNTIL IT'S TRAVERSED THE ENTIRE HISTORY OF TEZOS 1000 BLOCKS AT A TIME
base('Breeding Table').select({
  // get the last record
  maxRecords: 1000,
  sort: [{field: "ID", direction: "asc"}],
  view: "Grid view"
}).eachPage((records, fetchNextPage) => {
  // This function (`page`) will get called for each page of records.  
  console.log(records.length)

  //console.log('records', records)
  records.forEach((record) => {
    burnHistory.push(record.fields.BurnTxnID)
    lastKnownTransaction = record.fields.TransactionID
  });

  // To fetch the next page of records, call `fetchNextPage`.
  // If there are more records, `page` will get called again.
  // If there are no more records, `done` will get called.
  fetchNextPage();

}, function done(err) {
  console.log(`last known transaction = `, lastKnownTransaction )
  getTransactions(burnHistory)
  if (err) { console.error(err); return; }
});

//getTransactions()
