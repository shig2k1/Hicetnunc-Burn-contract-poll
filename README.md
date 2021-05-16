# Hicetnunc-Burn-contract-poll
To set up
1. Run npm install or yarn
2. Change the TOKEN_ID in get-burned-tokens script to something relevant
3. Set API & BASE keys for airtable in get-burned-tokens script
4. Update the table references in the script to whatever is relevant to your airtable
5. Run node get-burned-tokens

The script will poll and every minute will update the airtable if there's anything new

The mint-new-fishies script is part of the one I use; It will connect to the airtable and pull out the relevant rows; in my case the rows I've not done anything with are marked as 'pending' so they're the only ones it fetches