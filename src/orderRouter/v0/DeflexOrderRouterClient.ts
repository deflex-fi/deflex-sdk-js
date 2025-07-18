import axios from "axios";
import DeflexQuote from "./DeflexQuote";
import DeflexTransactionGroup from "./DeflexTransactionGroup";
import {
	CHAIN_MAINNET,
	CHAIN_TESTNET,
	DEFAULT_MAX_GROUP_SIZE,
	FETCH_EXECUTE_SWAP_TXNS_API,
	FETCH_QUOTE_API,
	ORDER_ROUTER_DEFAULT_FEE_BPS,
	TREASURY_ADDRESS,
	TYPE_FIXED_INPUT,
	TYPE_FIXED_OUTPUT
} from "../../constants";
import { performSafetyChecks } from "./safetyChecks";
import { Algodv2, Indexer } from "algosdk";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default class DeflexOrderRouterClient {

	algodUri: string
	algodToken: any
	algodPort: string
	chain: string
	referrerAddress: string
	apiKey: string
	feeBps: Number

	constructor(algodUri, algodToken, algodPort, chain, referrerAddress = '', feeBps = ORDER_ROUTER_DEFAULT_FEE_BPS, apiKey = '') {
		this.algodUri = algodUri
		this.algodToken = algodToken
		this.algodPort = algodPort
		this.chain = chain
		this.referrerAddress = referrerAddress
		this.feeBps = feeBps
		this.apiKey = apiKey
	}

	static fetchMainnetClient(algodUri, algodToken, algodPort, referrerAddress = '', feeBps = ORDER_ROUTER_DEFAULT_FEE_BPS, apiKey = '') : DeflexOrderRouterClient {
		return new this(algodUri, algodToken, algodPort, CHAIN_MAINNET, referrerAddress, feeBps, apiKey)
	}

	static fetchTestnetClient(algodUri, algodToken, algodPort, referrerAddress = '', feeBps = ORDER_ROUTER_DEFAULT_FEE_BPS, apiKey = '') : DeflexOrderRouterClient {
		return new this(algodUri, algodToken, algodPort, CHAIN_TESTNET, referrerAddress, feeBps, apiKey)
	}

	async getFixedInputSwapQuote(fromASAId, toASAId, amount, disabledProtocols = [], maxGroupSize = DEFAULT_MAX_GROUP_SIZE, atomicOnly = true) : Promise<DeflexQuote> {
		return await this.getSwapQuote(TYPE_FIXED_INPUT, fromASAId, toASAId, amount, disabledProtocols, maxGroupSize, atomicOnly)
	}

	async getFixedOutputSwapQuote(fromASAId, toASAId, amount, disabledProtocols = [], maxGroupSize = DEFAULT_MAX_GROUP_SIZE, atomicOnly = true) : Promise<DeflexQuote> {
		return await this.getSwapQuote(TYPE_FIXED_OUTPUT, fromASAId, toASAId, amount, disabledProtocols, maxGroupSize, atomicOnly)
	}

	async getSwapQuote(type, fromASAId, toASAId, amount, disabledProtocols, maxGroupSize, atomicOnly) {
		const quote = await fetchApiData(FETCH_QUOTE_API, {
			chain: this.chain,
			algodUri: this.algodUri,
			algodToken: typeof this.algodToken === 'object' ? JSON.stringify(this.algodToken) : this.algodToken,
			algodPort: this.algodPort,
			type: type,
			amount: amount,
			fromASAID: fromASAId,
			toASAID: toASAId,
			disabledProtocols: disabledProtocols.join(','),
			maxGroupSize: maxGroupSize,
			apiKey: this.apiKey,
			referrerAddress: this.referrerAddress,
			feeBps: this.feeBps,
			atomicOnly: atomicOnly,
		})
		return DeflexQuote.fromAPIResponse(type, fromASAId, toASAId, amount, quote)
	}

	async getSwapQuoteTransactions(address: string, quote: DeflexQuote, slippage: Number) : Promise<DeflexTransactionGroup> {
		const swapQuoteTransactionsData = await fetchApiData(FETCH_EXECUTE_SWAP_TXNS_API, {
			address: address,
			txnPayloadJSON: quote.txnPayload,
			slippage: slippage,
			apiKey: this.apiKey
		}, true)
		const txnGroup = DeflexTransactionGroup.fromApiResponse(swapQuoteTransactionsData)

		// assert safety checks
		await performSafetyChecks(new Algodv2(this.algodToken, this.algodUri, this.algodPort), txnGroup, address, quote, slippage, this.chain)

		return txnGroup
	}

	async computeUniqueUserAndTransactionCount(daysBack: number) {
		const daysBackTimestamp = Math.floor((new Date(Date.now() - daysBack * ONE_DAY_MS)).getTime() / 1000);
		let lastRoundTime
		let nextToken = null
		const indexer = new Indexer(this.algodToken, this.algodUri, this.algodPort)
		let users = {}
		let txnCount = 0
		do {
			const result = await this._getUserAndTransactionCount(indexer, nextToken)
			Object.keys(result.users).map((address) => {
				users[address] = true
			})
			txnCount += result.transactionCount
			lastRoundTime = result.roundTime
			nextToken = result.nextToken
		} while (lastRoundTime > daysBackTimestamp)
		console.log(`unique users = ${Object.keys(users).length}`)
		console.log(`unique swaps = ${txnCount}`)

	}

	async _getUserAndTransactionCount(indexer, nextToken: string) {
		let indexerQuery = indexer.searchForTransactions().address(TREASURY_ADDRESS)
		if (nextToken) {
			indexerQuery = indexerQuery.nextToken(nextToken)
		}

		let users = {}
		let txnCount = 0
		let round = null
		let roundTime = null
 		const txnsResponse = await indexerQuery.do()
		const nextTokenToReturn = txnsResponse['next-token']
		const txns = txnsResponse['transactions']
		txns.map(txn => {
  			const assetXferTxns = (txn['inner-txns'] || []).filter((innerTxn) => !!innerTxn['asset-transfer-transaction'] && !!innerTxn['asset-transfer-transaction']['close-to'])
			if (assetXferTxns.length > 0) {
				users[assetXferTxns[0]['asset-transfer-transaction']['close-to']] = true
				txnCount++
				round = assetXferTxns[0]['last-valid']
				roundTime = assetXferTxns[0]['round-time']
			}
		})
		return {
			transactionCount: txnCount,
			users: users,
			nextToken: nextTokenToReturn,
			round: round,
			roundTime: roundTime
		}
	}

}


async function fetchApiData(api, params, usePost = false) {
	let fullUrl = `https://deflex.txnlab.dev/api/${api}?`
	let quoteData
	if (usePost) {
		quoteData = await axios.post(fullUrl, params);
	} else {
		Object.keys(params).map((key, i) => {
			fullUrl = fullUrl + `${key}=${params[key]}&`
		})
		quoteData = await axios.get(fullUrl);
	}
	return quoteData.data
}
