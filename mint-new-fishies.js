const path = require('path');
const config = require('./webpack.config')
const fs = require('fs')
const webpack = require('webpack')

const timesnap = require('timesnap')

var Airtable = require('airtable');

const BASE_ID = '' // <--airtable base id
const API_KEY = '' // <--airtable api key

var base = new Airtable({ apiKey: API_KEY }).base(BASE_ID)


/* MINTING - 
What it SHOULD do once I've completely finished it
1. get the last record from airtable - look at the level
2. fetch all the records in batches of 1000 until we've reached the level of the last item - if there was no last item, only get one
3. for each burn transaction - check in airtable, if doesn't exist, create it
*/
const fishiesToMint = []

console.log('Minting new fishies')

base('Breeding Table').select({
  filterByFormula: 'Status = "pending"',
  /*sort: [{ field: 'DOB', direction: 'asc' }],*/
  // get the last record
  maxRecords: 1000,
  view: "Grid view"
}).eachPage(function page(records, fetchNextPage) {
  // This function (`page`) will get called for each page of records.

  records.forEach(function(record) {
    fishiesToMint.push(record)
  });

  if (fishiesToMint.length > 0) mintFishies()
  else console.log('No fishies to mint')

  // To fetch the next page of records, call `fetchNextPage`.
  // If there are more records, `page` will get called again.
  // If there are no more records, `done` will get called.
  // fetchNextPage();

}, function done(err) {
  console.log(`that's all folks!`)
  if (err) { console.error(err); return; }
});

async function mintFishies () {
  for (let i=0; i< fishiesToMint.length; i++) {
    const fish = fishiesToMint[i]
    const { ID, TransactionLevel, BurnTxnID, BreederTZ, BreederName, DOB, Status, BurnCounter } = fish.fields
    let transactionHash = `${BurnTxnID}${BurnCounter}`
    
    // do whatever it is you want to with the current record
    // this is where I call generation scripts through webpack & zip up
    
  }
}