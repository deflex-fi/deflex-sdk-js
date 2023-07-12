const deflex = require("../.");
const algosdk = require("algosdk")

async function run() {
	const token = ''
	const uri = 'https://node.testnet.algoexplorerapi.io'
	const sender = algosdk.mnemonicToSecretKey('bottom stone elegant just symbol bunker review curve laugh burden jewel pepper replace north tornado alert relief wrist better property spider picture insect abandon tuna')
	const client = deflex.DeflexOrderRouterClient.fetchTestnetClient(uri, token, '')
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
	const txnGroup = await client.getSwapQuoteTransactions(sender.addr, quote, 5)

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
}

run()
