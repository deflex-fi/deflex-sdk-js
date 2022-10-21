import axios from "axios";
import DeflexQuote from "./DeflexQuote";
import DeflexTransactionGroup from "./DeflexTransactionGroup";
import {CHAIN_MAINNET,
	CHAIN_TESTNET,
	TYPE_FIXED_INPUT,
	TYPE_FIXED_OUTPUT,
	FETCH_QUOTE_API,
	FETCH_EXECUTE_SWAP_TXNS_API,
	ORDER_ROUTER_DEFAULT_FEE_BPS,
	DEFAULT_MAX_GROUP_SIZE} from "../../constants";

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
		return DeflexQuote.fromAPIResponse(quote)
	}

	async getSwapQuoteTransactions(address, txnPayload, slippage) : Promise<DeflexTransactionGroup> {
		const swapQuoteTransactionsData = await fetchApiData(FETCH_EXECUTE_SWAP_TXNS_API, {
			address: address,
			txnPayloadJSON: txnPayload,
			slippage: slippage,
			apiKey: this.apiKey
		}, true)
		return DeflexTransactionGroup.fromApiResponse(swapQuoteTransactionsData)
	}
}


async function fetchApiData(api, params, usePost = false) {
	let fullUrl = `https://api.deflex.fi/api/${api}?`
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