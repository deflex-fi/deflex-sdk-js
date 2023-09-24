const deflex = require("../.");
const {
	Algodv2, Indexer, mnemonicToSecretKey, makeAssetTransferTxnWithSuggestedParamsFromObject,
	makeBasicAccountTransactionSigner, makePaymentTxnWithSuggestedParamsFromObject, getApplicationAddress,
	makeApplicationNoOpTxnFromObject, waitForConfirmation
} = require("algosdk");

function createAlgodClient(chain = deflex.constants.CHAIN_TESTNET) {
	if (chain === deflex.constants.CHAIN_MAINNET) {
		return new Algodv2('', 'https://mainnet-api.algonode.cloud', '')
	} else if (chain === deflex.constants.CHAIN_TESTNET) {
		return new Algodv2('', 'https://testnet-api.algonode.cloud', '')
	}
}

function createIndexerClient(chain = deflex.constants.CHAIN_TESTNET) {
	if (chain === deflex.constants.CHAIN_MAINNET) {
		return new Indexer('', 'https://mainnet-idx.algonode.cloud', '')
	} else if (chain === deflex.constants.CHAIN_TESTNET) {
		return new Indexer('', 'https://testnet-idx.algonode.cloud', '')
	}
}

async function optAccountIntoAsset(algodClient, userPk, userSk, assetId) {
	if (assetId === deflex.constants.ALGO_ASSET_ID) {
		return
	}
	const params = await algodClient.getTransactionParams().do()
	const txn = makeAssetTransferTxnWithSuggestedParamsFromObject({
		from: userPk,
		to: userPk,
		suggestedParams: params,
		amount: 0,
		assetIndex: assetId
	})
	const signedTxn = txn.signTxn(userSk)
	await algodClient.sendRawTransaction(signedTxn).do()
	await waitForConfirmation(algodClient, txn.txID(), 10)
}

async function run() {
	const protocolVersion = 1;
	const chain = deflex.constants.CHAIN_TESTNET
	const algodClient = createAlgodClient(chain)
	const indexer = createIndexerClient(chain)

	const userAddress = 'DWQXOZMGDA6QZRSPER6O4AMTO3BQ6CEJMFO25EWRRBK72RJO54GLDCGK4E'
	const userMnemonic = 'bottom stone elegant just symbol bunker review curve laugh burden jewel pepper replace north tornado alert relief wrist better property spider picture insect abandon tuna'
	const userAccount = mnemonicToSecretKey(userMnemonic)

	const platformClient = new deflex.DeflexLimitOrderPlatformClient(algodClient, indexer, chain, userAddress, userMnemonic, protocolVersion)
	const fillerClient = new deflex.DeflexLimitOrderFillerClient(algodClient, chain, userMnemonic, protocolVersion)

	console.log('Listing filled order count (first page)')
	const orders = await platformClient.fetchFilledOrders()
	console.log(`${orders.orders.length} filled orders.`)

	console.log('Check if a limit-order app exists')
	let limitOrderAppIds = await platformClient.getLimitOrderAppIds()
	if (limitOrderAppIds.length > 0) {
		console.log(`Found the following app IDs: ${limitOrderAppIds.join(', ')}`)
	} else {
		console.log('Create the limit-order app')
		let composer = await platformClient.prepareCreateLimitOrderApp()
		let response = await composer.execute(algodClient, 1000)
		const txnResponse = await algodClient.pendingTransactionInformation(response.txIDs[0]).do()
		const limitOrderAppId = txnResponse['application-index']
		console.log(`Initialize limit-order app ${limitOrderAppId}`)
		composer = await platformClient.prepareUserInitialize(limitOrderAppId)
		await composer.execute(algodClient, 1000)
		limitOrderAppIds = [limitOrderAppId]
	}

	// we use the first applicable limit-order app
	const limitOrderAppId = limitOrderAppIds[limitOrderAppIds.length - 1]

	// define limit order with ALGO/WALGO-TS
	const inputAssetId =  deflex.constants.ALGO_ASSET_ID// 14704676
	const outputAssetId = 14704676
	const inputAmount = 1000000
	const outputAmount = 20000
	const expirationDate = Number.MAX_SAFE_INTEGER

	const userOptedIntoInputAsset = await deflex.util.isOptedIntoAsset(algodClient, userAddress, inputAssetId)
	if (!userOptedIntoInputAsset) {
		await optAccountIntoAsset(algodClient, userAddress, userAccount.sk, inputAssetId)
	}
	const userOptedIntoOutputAsset = await deflex.util.isOptedIntoAsset(algodClient, userAddress, outputAssetId)
	if (!userOptedIntoOutputAsset) {
		await optAccountIntoAsset(algodClient, userAddress, userAccount.sk, outputAssetId)
	}

	console.log('Fetching all open limit orders')
	const openOrders = await deflex.DeflexLimitOrderFillerClient.fetchAllOpenOrders(indexer, chain, protocolVersion)

	for (let i = 0; i < openOrders.length; i++) {
		console.log(`There's an open limit order with address ${openOrders[i].escrowAddress}`)
	}

	let limitOrder
	if (openOrders.length === 0) {
		console.log('Creating limit order')
		limitOrder = new deflex.LimitOrderParams(
			userAddress,
			userAddress,
			limitOrderAppId,
			deflex.RegistryAppAPI.getAppId(chain, protocolVersion),
			userAddress,
			inputAssetId,
			outputAssetId,
			inputAmount,
			outputAmount,
			expirationDate,
			'',
			6
		)
		const composer = await platformClient.prepareCreateOrder(limitOrder)
		await composer.execute(algodClient, 1000)
		console.log(`Created limit order with escrow address ${limitOrder.escrowAddress}`)
	} else {
		limitOrder = openOrders[0]
	}

	/*
	console.log('Cancelling limit order')
	let composer = await platformClient.prepareCancelOrder(limitOrder)
	await composer.execute(algodClient, 1000)
	 */


	// fill order (order is filled with Pact liquidity)
	let swapTxns = []
	const suggestedParams = await algodClient.getTransactionParams().do()
	const pactAppId = 70591284 // ALGO-WALGO
	const userSigner = makeBasicAccountTransactionSigner(userAccount)
	swapTxns.push({
		txn: makePaymentTxnWithSuggestedParamsFromObject({
			from: userAccount.addr,
			suggestedParams: suggestedParams,
			to: getApplicationAddress(pactAppId),
			amount: limitOrder.amountIn,
			rekeyTo: undefined
		}),
		signer: userSigner
	})
	swapTxns.push({
		txn: makeApplicationNoOpTxnFromObject({
			from: userAccount.addr,
			suggestedParams: suggestedParams,
			appIndex: pactAppId,
			appArgs: [new Uint8Array(Buffer.from('U1dBUA==', 'base64')), new Uint8Array(Buffer.from('AAAAAAAAAAA=', 'base64'))],
			foreignAssets: [inputAssetId, outputAssetId],
			rekeyTo: undefined,
			accounts: [],
			foreignApps: [],
		}),
		signer: userSigner
	})
	swapTxns.push({
		txn: makeAssetTransferTxnWithSuggestedParamsFromObject({
			from: userAccount.addr,
			suggestedParams: suggestedParams,
			to: getApplicationAddress(limitOrderAppId),
			amount: parseInt(limitOrder.amountOut * ((10000 + limitOrder.feeBps) / 10000)),
			assetIndex: limitOrder.assetOutId,
			rekeyTo: undefined
		}),
		signer: userSigner
	})
	swapTxns[0].txn.fee = 1000
	swapTxns[1].txn.fee = 2000
	swapTxns[2].txn.fee = 1000

	console.log(`Filling limit order ${limitOrder.escrowAddress}`)

	composer = await fillerClient.prepareBackendFillOrder(limitOrder, swapTxns, userAddress, userAddress, suggestedParams)
	await composer.execute(algodClient, 1000)

	/*
	console.log('Opting limit order app out of assets')
	composer = await platformClient.prepareOptOutAssets(limitOrderAppId, [outputAssetId])
	await composer.execute(algodClient, 1000)

	console.log('Deleteing limit order app')
	composer = await platformClient.prepareDeleteLimitOrderApp(limitOrderAppId)
	await composer.execute(algodClient, 1000)
	 */
}

run()
