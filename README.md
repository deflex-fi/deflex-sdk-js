# Deflex SDK (Javascript)

Deflex Javascript SDK for order routing and limit orders.

### Installation

Run: `npm install @txnlab/deflex-sdk-js`

## Order Routing

### Fetch Deflex Quote

To fetch an Deflex quote, initialize the client and use:

- `getFixedInputSwapQuote` for a fixed input swap
- `getFixedOutputSwapQuote` for a fixed output swap

Example (for fixed input):

```
import {DeflexOrderRouterClient} from '@txnlab/deflex-sdk-js'
import algosdk from 'algosdk'

const token = '<INSERT ALGOD TOKEN>'
const uri = '<INSERT ALGOD URI>'

const sender = algosdk.mnemonicToSecretKey('bottom stone elegant just symbol bunker review curve laugh burden jewel pepper replace north tornado alert relief wrist better property spider picture insect abandon tuna')
const client = deflex.DeflexOrderRouterClient.fetchTestnetClient(uri, token, '', sender.addr)
const quote = await client.getFixedInputSwapQuote(0, 10458941, 1000000)
const algod = new algosdk.Algodv2(token, uri, '')
const params = await algod.getTransactionParams().do()

const requiredAppOptIns = quote.requiredAppOptIns

// opt into required app for swap
const accountInfo = await algod.accountInformation(sender.addr).do()
const optedInAppIds = 'apps-local-state' in accountInfo ? accountInfo['apps-local-state'].map((state) => parseInt(state.id)) : []
for (let i = 0; i < requiredAppOptIns.length; i++) {
    const requiredAppId = requiredAppOptIns[i]
    if (!optedInAppIds.includes(requiredAppId)) {
        const appOptInTxn = algosdk.makeApplicationOptInTxn(sender.addr, params, requiredAppId)
        const signedTxn = appOptInTxn.signTxn(sender.sk)
        await algod
            .sendRawTransaction(signedTxn)
            .do();
    }
}
```

### Fetch Transaction Group for Executing Deflex Quote

To fetch the transaction group for executing an Deflex quote,
use `getSwapQuoteTransactions`.

Example (using quote from example above):

```
...

const slippage = 0.5
const txnGroup = await client.getSwapQuoteTransactions(swapperAddress, quote.txnPayload, slippage)

const signedTxns = txnGroup.txns.map((txn) => {
	if (txn.logicSigBlob !== false) {
		return txn.logicSigBlob
	} else {
		let bytes = new Uint8Array(Buffer.from(txn.data, 'base64'))
		const decoded = algosdk.decodeUnsignedTransaction(bytes)
		return algosdk.signTransaction(decoded, sender.sk).blob
	}
})
const {txId} = await algod
	.sendRawTransaction(signedTxns)
	.do();
console.log(txId)
```

## Limit Orders

To manage (create and cancel) limit orders, first create a `DeflexLimitOrderPlatformClient`
and make sure a limit order application has been created for the user.

See `examples/limitOrderExample.js` for an example usage.

To fill limit orders, create a `DeflexLimitOrderFillerClient`.

See `examples/limitOrderExample.js` for an example usage.
