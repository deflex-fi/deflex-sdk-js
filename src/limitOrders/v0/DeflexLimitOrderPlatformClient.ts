import {
	Algodv2,
	AtomicTransactionComposer,
	generateAccount,
	getApplicationAddress,
	makeApplicationCreateTxnFromObject, makeApplicationDeleteTxnFromObject,
	makeApplicationOptInTxnFromObject,
	makeAssetTransferTxnWithSuggestedParamsFromObject,
	makeBasicAccountTransactionSigner,
	makePaymentTxnWithSuggestedParamsFromObject,
	mnemonicToSecretKey,
	OnApplicationComplete,
	TransactionSigner
} from "algosdk";
import LimitOrderApp, {
	EXTRA_PROGRAM_PAGES,
	GLOBAL_STATE_BYTES,
	GLOBAL_STATE_INTS,
	LOCAL_STATE_BYTES,
	LOCAL_STATE_INTS,
	MINIMUM_BALANCE_FOR_ACCOUNT,
	MINIMUM_BALANCE_FOR_OPT_IN
} from "./limitOrderApp";
import LimitOrderAppAPI, {
	USER_CANCEL_ORDER,
	USER_CREATE_ORDER,
	USER_DELETE_APP,
	USER_INITIALIZE,
	USER_OPT_INTO_ASSETS,
	USER_OPT_OUT_ASSETS
} from "./limitOrderAppAPI";
import LimitOrderParams from "./LimitOrderParams";
import {ALGO_ASSET_ID, CHAIN_MAINNET, CHAIN_TESTNET} from "../../constants";
import RegistryAppAPI, {BACKEND_CLOSE_ESCROW} from "./registryAppAPI";
import {isOptedIntoAsset} from "./util";

export default class DeflexLimitOrderPlatformClient {

	algod: Algodv2
	chain: string
	userAddress: string
	userPrivateKey: string
	signer: TransactionSigner

	constructor(algod: Algodv2, chain: string, userAddress: string, userMnemonic: string) {
		this.algod = algod
		this.chain = chain
		this.userAddress = userAddress
		this.userPrivateKey = userMnemonic
		const account = mnemonicToSecretKey(userMnemonic)
		this.signer = makeBasicAccountTransactionSigner(account)
	}

	static fetchMainnetClient(algod: Algodv2, userAddress: string, userPrivateKey: string) : DeflexLimitOrderPlatformClient {
		return new this(algod, CHAIN_MAINNET, userAddress, userPrivateKey)
	}

	static fetchTestnetClient(algod: Algodv2, userAddress: string, userPrivateKey: string) : DeflexLimitOrderPlatformClient {
		return new this(algod, CHAIN_TESTNET, userAddress, userPrivateKey)
	}

	static getMinimumEscrowBalance() : number {
		let balance = 100000 // minimum for any account
		balance += 100000 // to opt into registry app
		balance += MINIMUM_BALANCE_FOR_OPT_IN
		return balance
	}

	async prepareCreateLimitOrderApp() : Promise<AtomicTransactionComposer> {
		const composer = new AtomicTransactionComposer()
		const params = await this.algod.getTransactionParams().do()
		composer.addTransaction({
			txn: makeApplicationCreateTxnFromObject({
				from: this.userAddress,
				suggestedParams: params,
				onComplete: OnApplicationComplete.NoOpOC,
				approvalProgram: LimitOrderApp.approvalProgramBytes(this.chain),
				clearProgram: LimitOrderApp.clearStateProgramBytes(this.chain),
				numLocalInts: LOCAL_STATE_INTS,
				numLocalByteSlices: LOCAL_STATE_BYTES,
				numGlobalInts: GLOBAL_STATE_INTS,
				numGlobalByteSlices: GLOBAL_STATE_BYTES,
				extraPages: EXTRA_PROGRAM_PAGES,
				accounts: [],
				foreignApps: [],
				foreignAssets: [],
				rekeyTo: undefined
			}),
			signer: this.signer
		})
		return composer
	}

	async prepareUserInitialize(limitOrderAppId: number) : Promise<AtomicTransactionComposer> {
		const composer = new AtomicTransactionComposer()
		const params = await this.algod.getTransactionParams().do()

		// payment txn to increase the minimum balance of the limit order app
		const minBalanceTxn = {
			txn: makePaymentTxnWithSuggestedParamsFromObject({
				from: this.userAddress,
				suggestedParams: params,
				to: getApplicationAddress(limitOrderAppId),
				amount: MINIMUM_BALANCE_FOR_ACCOUNT,
				rekeyTo: undefined
			}),
			signer: this.signer,
		}

		// initialize the app
		let initializeParams = {...params}
		initializeParams.fee = 1000
		initializeParams.flatFee = true
		composer.addMethodCall({
			appID: limitOrderAppId,
			method: LimitOrderAppAPI.getMethod(USER_INITIALIZE),
			sender: this.userAddress,
			suggestedParams: initializeParams,
			signer: this.signer,
			methodArgs: [minBalanceTxn],
			onComplete: OnApplicationComplete.NoOpOC,
		})
		return composer
	}

	async prepareCreateOrder(limitOrder: LimitOrderParams): Promise<AtomicTransactionComposer> {
		const composer = new AtomicTransactionComposer()
		const temporaryComposer = new AtomicTransactionComposer()
		const params = await this.algod.getTransactionParams().do()
		const escrowAccount = generateAccount()
		limitOrder.escrowAddress = escrowAccount.addr
		const escrowSigner = makeBasicAccountTransactionSigner(escrowAccount)

		// fund the escrow

		let escrowFundParams = {...params}
		// we pay 2*fee from the user to cover for the registry-optin
		escrowFundParams.fee = 2000
		escrowFundParams.flatFee = true

		composer.addTransaction({
			txn: makePaymentTxnWithSuggestedParamsFromObject({
				from: limitOrder.userAddress,
				suggestedParams: escrowFundParams,
				to: escrowAccount.addr,
				amount: DeflexLimitOrderPlatformClient.getMinimumEscrowBalance(),
				note: (new TextEncoder()).encode('escrow_fund'),
				rekeyTo: undefined
			}),
			signer: this.signer,
		})

		const limitOrderAppAddress = getApplicationAddress(limitOrder.limitOrderAppId)
		const limitOrderOptedIntoInput = await isOptedIntoAsset(this.algod, limitOrderAppAddress, limitOrder.assetInId)
		const limitOrderOptedIntoOutput = await isOptedIntoAsset(this.algod, limitOrderAppAddress, limitOrder.assetOutId)

		// opt the limit order app into the necessary assets
		let assetIds = []
		if (!limitOrderOptedIntoInput) {
			assetIds.push(limitOrder.assetInId)
		}
		if (!limitOrderOptedIntoOutput) {
			assetIds.push(limitOrder.assetOutId)
		}

		if (assetIds.length > 0) {
			// payment txn to increase the minimum balance of the limit order app
			const minBalanceTxn = {
				txn: makePaymentTxnWithSuggestedParamsFromObject({
					from: this.userAddress,
					suggestedParams: params,
					to: getApplicationAddress(limitOrder.limitOrderAppId),
					amount: 100000 * assetIds.length,
					note: (new TextEncoder()).encode('minimum_balance'),
					rekeyTo: undefined
				}),
				signer: this.signer,
			}
			// opt the limit order app into the assets
			let optInParams = {...params}
			optInParams.fee = 1000 * (1 + assetIds.length)
			optInParams.flatFee = true
			temporaryComposer.addMethodCall({
				appID: limitOrder.limitOrderAppId,
				method: LimitOrderAppAPI.getMethod(USER_OPT_INTO_ASSETS),
				sender: this.userAddress,
				suggestedParams: optInParams,
				signer: this.signer,
				methodArgs: [minBalanceTxn],
				onComplete: OnApplicationComplete.NoOpOC,
			})
			const txns = temporaryComposer.buildGroup().map((txnAndSigner) => txnAndSigner.txn)
			txns[1].appForeignAssets = assetIds
			delete (txns[0].group)
			delete (txns[1].group)
			composer.addTransaction({
				txn: txns[0],
				signer: this.signer
			})
			composer.addTransaction({
				txn: txns[1],
				signer: this.signer
			})
		}

		// opt the escrow into the limit order app

		let escrowOptInParams = {...params}
		escrowOptInParams.fee = 0
		escrowOptInParams.flatFee = true

		const escrowOptInTxn = {
			txn: makeApplicationOptInTxnFromObject({
				from: limitOrder.escrowAddress,
				suggestedParams: escrowOptInParams,
				appIndex: limitOrder.limitOrderAppId,
				rekeyTo: getApplicationAddress(limitOrder.limitOrderAppId),
				accounts: [],
				foreignApps: [],
				foreignAssets: [],
			}),
			signer: escrowSigner,
		}

		// send 0.05 ALGO as compensation for network fees
		const networkFeeTxn = {
			txn: makePaymentTxnWithSuggestedParamsFromObject({
				from: this.userAddress,
				suggestedParams: params,
				to: getApplicationAddress(limitOrder.limitOrderAppId),
				amount: 50000,
				note: (new TextEncoder()).encode('network_fee'),
				rekeyTo: undefined
			}),
			signer: this.signer,
		}

		// send the input amount from user to limit order app
		let fundingTxn
		if (limitOrder.assetInId === ALGO_ASSET_ID) {
			fundingTxn = {
				txn: makePaymentTxnWithSuggestedParamsFromObject({
					from: this.userAddress,
					suggestedParams: params,
					to: getApplicationAddress(limitOrder.limitOrderAppId),
					amount: limitOrder.amountIn,
					note: (new TextEncoder()).encode('funding'),
					rekeyTo: undefined
				}),
				signer: this.signer,
			}
		} else {
			fundingTxn = {
				txn: makeAssetTransferTxnWithSuggestedParamsFromObject({
					from: this.userAddress,
					suggestedParams: params,
					assetIndex: limitOrder.assetInId,
					to: getApplicationAddress(limitOrder.limitOrderAppId),
					amount: limitOrder.amountIn,
					note: (new TextEncoder()).encode('funding'),
					rekeyTo: undefined,
					revocationTarget: undefined,
				}),
				signer: this.signer,
			}
		}

		// register the limit order with the limit order app

		let createOrderParams = {...params}
		createOrderParams.fee = 2000
		createOrderParams.flatFee = true

		composer.addMethodCall({
			appID: limitOrder.limitOrderAppId,
			method: LimitOrderAppAPI.getMethod(USER_CREATE_ORDER),
			sender: this.userAddress,
			suggestedParams: createOrderParams,
			signer: this.signer,
			methodArgs: [
				escrowOptInTxn,
				networkFeeTxn,
				fundingTxn,
				escrowAccount.addr,
				limitOrder.beneficiaryAddress,
				limitOrder.platformTreasuryAddress,
				limitOrder.assetInId,
				limitOrder.amountIn,
				limitOrder.assetOutId,
				limitOrder.amountOut,
				limitOrder.expirationDate,
				limitOrder.feeBps,
				limitOrder.registryAppId,
				limitOrder.backendAddress,
				limitOrder.note
			],
			onComplete: OnApplicationComplete.NoOpOC,
		})

		return composer
	}

	async prepareCancelOrder(limitOrder: LimitOrderParams): Promise<AtomicTransactionComposer> {
		const composer = new AtomicTransactionComposer()
		const params = await this.algod.getTransactionParams().do()
		let cancelOrderParams = {...params}
		cancelOrderParams.fee = 4000
		cancelOrderParams.flatFee = true

		// txn 0: cancel the limit order
		composer.addMethodCall({
			appID: limitOrder.limitOrderAppId,
			method: LimitOrderAppAPI.getMethod(USER_CANCEL_ORDER),
			sender: this.userAddress,
			suggestedParams: cancelOrderParams,
			signer: this.signer,
			methodArgs: [
				limitOrder.escrowAddress,
				limitOrder.beneficiaryAddress,
				limitOrder.assetInId,
				limitOrder.registryAppId
			],
			onComplete: OnApplicationComplete.NoOpOC,
		})

		let closeOutEscrowParams = {...params}
		closeOutEscrowParams.fee = 3000
		closeOutEscrowParams.flatFee = true

		// txn 1: close out the escrow
		composer.addMethodCall({
			appID: limitOrder.registryAppId,
			method: RegistryAppAPI.getMethod(BACKEND_CLOSE_ESCROW),
			sender: this.userAddress,
			suggestedParams: closeOutEscrowParams,
			signer: this.signer,
			methodArgs: [
				limitOrder.limitOrderAppId,
				limitOrder.escrowAddress,
				limitOrder.userAddress
			],
			onComplete: OnApplicationComplete.NoOpOC,
		})

		return composer
	}

	async prepareOptOutAssets(limitOrderAppId: number, assetIds: number[]): Promise<AtomicTransactionComposer> {
		const composer = new AtomicTransactionComposer()
		const temporaryComposer = new AtomicTransactionComposer()
		const params = await this.algod.getTransactionParams().do()

		// opt the limit order app out of the assets
		let optOutParams = {...params}
		optOutParams.fee = 1000 * (2 + assetIds.length)
		optOutParams.flatFee = true
		temporaryComposer.addMethodCall({
			appID: limitOrderAppId,
			method: LimitOrderAppAPI.getMethod(USER_OPT_OUT_ASSETS),
			sender: this.userAddress,
			suggestedParams: optOutParams,
			signer: this.signer,
			methodArgs: [],
			onComplete: OnApplicationComplete.NoOpOC,
		})
		const txns = temporaryComposer.buildGroup().map((txnAndSigner) => txnAndSigner.txn)
		txns[0].appForeignAssets = assetIds
		composer.addTransaction({
			txn: txns[0],
			signer: this.signer
		})
		return composer
	}

	async prepareDeleteLimitOrderApp(limitOrderAppId: number): Promise<AtomicTransactionComposer> {
		const composer = new AtomicTransactionComposer()
		const params = await this.algod.getTransactionParams().do()
		const deleteParams = {...params}
		deleteParams.fee = 2000
		deleteParams.flatFee = true
		composer.addMethodCall({
			appID: limitOrderAppId,
			method: LimitOrderAppAPI.getMethod(USER_DELETE_APP),
			sender: this.userAddress,
			suggestedParams: deleteParams,
			signer: this.signer,
			methodArgs: [],
			onComplete: OnApplicationComplete.DeleteApplicationOC,
		})
		return composer
	}


	async getLimitOrderAppIds(): Promise<number[]> {
		let result = []
		const expectedApprovalBytes = LimitOrderApp.approvalProgramBytes(this.chain)
		const expectedClearBytes = LimitOrderApp.clearStateProgramBytes(this.chain)
		const accountInfo = await this.algod.accountInformation(this.userAddress).do()
		const createdApps = accountInfo['created-apps']

		const areEqual = (first, second) =>
			first.length === second.length && first.every((value, index) => value === second[index])

		for (let i = 0; i < createdApps.length; i++) {
			const createdApp = createdApps[i]
			const approvalBytes = new Uint8Array(Buffer.from(createdApp['params']['approval-program'], 'base64'))
			const clearBytes = new Uint8Array(Buffer.from(createdApp['params']['clear-state-program'], 'base64'))
			if (areEqual(approvalBytes, expectedApprovalBytes) && areEqual(clearBytes, expectedClearBytes)) {
				result.push(createdApp['id'])
			}
		}
		return result
	}



}