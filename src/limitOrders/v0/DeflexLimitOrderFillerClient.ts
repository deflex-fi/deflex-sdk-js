import {
    Account,
    Algodv2, AtomicTransactionComposer, encodeAddress, getApplicationAddress, Indexer,
    makeBasicAccountTransactionSigner, makePaymentTxnWithSuggestedParamsFromObject,
    mnemonicToSecretKey, OnApplicationComplete, SuggestedParams,
    TransactionSigner, TransactionWithSigner
} from "algosdk";
import {CHAIN_MAINNET, CHAIN_TESTNET, PROTOCOL_VERSION_0, PROTOCOL_VERSION_1} from "../../constants";
import RegistryAppAPI, {BACKEND_CLOSE_ESCROW} from "./registryAppAPI";
import LimitOrderParams from "./LimitOrderParams";
import {getStateBytes, getStateInt, isOptedIntoAsset} from "./util";
import ProtocolTreasuryAppAPI from "./protocolTreasuryAppAPI";
import {USER_OPT_INTO_ASSETS} from "./protocolTreasuryAppAPI";
import LimitOrderAppAPI, {BACKEND_FILL_ORDER_FINALIZE, BACKEND_FILL_ORDER_INITIALIZE} from "./limitOrderAppAPI";

export default class DeflexLimitOrderFillerClient {

    algod: Algodv2
    chain: string
    account: Account
    signer: TransactionSigner
    protocolVersion: number

    constructor(algod: Algodv2, chain: string, signerMnemonic: string, protocolVersion: number) {
        this.algod = algod
        this.chain = chain
        this.account = mnemonicToSecretKey(signerMnemonic)
        this.protocolVersion = protocolVersion
        this.signer = makeBasicAccountTransactionSigner(this.account)
    }

    static fetchMainnetClient(algod: Algodv2, signerPrivateKey: string, protocolVersion: number): DeflexLimitOrderFillerClient {
        return new this(algod, CHAIN_MAINNET, signerPrivateKey, protocolVersion)
    }

    static fetchTestnetClient(algod: Algodv2, signerPrivateKey: string,  protocolVersion: number): DeflexLimitOrderFillerClient {
        return new this(algod, CHAIN_TESTNET, signerPrivateKey, protocolVersion)
    }

    static async fetchAllOpenOrders(indexer: Indexer, chain: string, protocolVersion: number) : Promise<LimitOrderParams[]> {
        const limitOrders = await fetchAllOrders(indexer, chain, protocolVersion)
        const now = (new Date()).getTime() / 1000
        return limitOrders.filter((order) => now <= order.expirationDate)
    }

    static async fetchAllExpiredOrders(indexer: Indexer, chain: string, protocolVersion: number): Promise<LimitOrderParams[]> {
        const limitOrders = await fetchAllOrders(indexer, chain, protocolVersion)
        const now = (new Date()).getTime() / 1000
        return limitOrders.filter((order) => now > order.expirationDate)
    }

    static limitOrderFromAccount(account: object) : LimitOrderParams {
        const localStates = account['apps-local-state']
        for (let i = 0; i < localStates.length; i++) {
            const localState = localStates[i]
            if (!('key-value' in localState)) {
                continue
            }
            const appId = localState['id']
            try {
                let limitOrderState = {}
                for (let j = 0; j < localState['key-value'].length; j++) {
                    const keyValue = localState['key-value'][j]
                    limitOrderState[keyValue['key']] = keyValue['value']
                }
                return new LimitOrderParams(
                    encodeAddress(getStateBytes(limitOrderState, 'user_address')),
                    encodeAddress(getStateBytes(limitOrderState, 'beneficiary_address')),
                    appId,
                    getStateInt(limitOrderState, 'registry_app_id'),
                    encodeAddress(getStateBytes(limitOrderState, 'platform_treasury_address')),
                    getStateInt(limitOrderState, 'asset_in_id'),
                    getStateInt(limitOrderState, 'asset_out_id'),
                    getStateInt(limitOrderState, 'amount_in'),
                    getStateInt(limitOrderState, 'amount_out'),
                    getStateInt(limitOrderState, 'expiration_date'),
                    getStateBytes(limitOrderState, 'note').toString('utf-8'),
                    getStateInt(limitOrderState, 'fee_bps'),
                    encodeAddress(getStateBytes(limitOrderState, 'backend_address')),
                    account['address']
                )
            } catch (e) {
                continue
            }
        }
        throw new Error(`could not create limit order for account ${account['address']}`)
    }

    async prepareBackendFillOrder(limitOrder: LimitOrderParams,
                                  swapTxns: TransactionWithSigner[],
                                  swapAddress: string,
                                  backendTreasury: string,
                                  params? : SuggestedParams) : Promise<AtomicTransactionComposer> {
        if (!params) {
            params = await this.algod.getTransactionParams().do()
        }
        const composer = new AtomicTransactionComposer()

        // opt creator treasury into output asset, if not opted in
        const protocolTreasuryAppId = ProtocolTreasuryAppAPI.getAppId(this.chain)
        const protocolTreasuryAppAddress = getApplicationAddress(protocolTreasuryAppId)
        const protocolTreasuryOptedIntoOutput = await isOptedIntoAsset(this.algod, protocolTreasuryAppAddress, limitOrder.assetOutId)
        if (!protocolTreasuryOptedIntoOutput) {
            // payment transactions
            const temporaryComposer = new AtomicTransactionComposer()
            const fundingParams = {...params}
            fundingParams.fee = 1000
            fundingParams.flatFee = true
            const fundingTxn = {
                txn: makePaymentTxnWithSuggestedParamsFromObject({
                    from: this.account.addr,
                    suggestedParams: fundingParams,
                    to: getApplicationAddress(protocolTreasuryAppId),
                    amount: 100000,
                    rekeyTo: undefined
                }),
                signer: this.signer,
            }
            // method call
            let optInParams = {...params}
            optInParams.fee = 2000
            optInParams.flatFee = true
            temporaryComposer.addMethodCall({
                appID: protocolTreasuryAppId,
                method: ProtocolTreasuryAppAPI.getMethod(USER_OPT_INTO_ASSETS),
                sender: this.account.addr,
                suggestedParams: optInParams,
                signer: this.signer,
                methodArgs: [fundingTxn],
                onComplete: OnApplicationComplete.NoOpOC,
            })
            const txns = temporaryComposer.buildGroup().map((txnAndSigner) => txnAndSigner.txn)
            txns[1].appForeignAssets = [limitOrder.assetOutId]
            delete(txns[0].group)
            delete(txns[1].group)
            composer.addTransaction({
                txn: txns[0],
                signer: this.signer
            })
            composer.addTransaction({
                txn: txns[1],
                signer: this.signer
            })
        }
        // signal to limit order app that the order is being processed
        const initializeParams = {...params}
        initializeParams.fee = 2000
        initializeParams.flatFee = true
        composer.addMethodCall({
            appID: limitOrder.limitOrderAppId,
            method: LimitOrderAppAPI.getMethod(BACKEND_FILL_ORDER_INITIALIZE),
            sender: this.account.addr,
            suggestedParams: initializeParams,
            signer: this.signer,
            methodArgs: [limitOrder.escrowAddress, swapAddress, limitOrder.assetInId, limitOrder.assetOutId],
            onComplete: OnApplicationComplete.NoOpOC,
        })

        // add swap transactions
        for (let i = 0; i < swapTxns.length; i++) {
            composer.addTransaction(swapTxns[i])
        }

        // finalize the limit order with a single call to BACKEND_FILL_ORDER_FINALIZE
        const finalizeParams = {...params}
        finalizeParams.fee = 7000
        finalizeParams.flatFee = true
        composer.addMethodCall({
            appID: limitOrder.limitOrderAppId,
            method: LimitOrderAppAPI.getMethod(BACKEND_FILL_ORDER_FINALIZE),
            sender: this.account.addr,
            suggestedParams: finalizeParams,
            signer: this.signer,
            methodArgs: [
                limitOrder.escrowAddress,
                limitOrder.beneficiaryAddress,
                limitOrder.platformTreasuryAddress,
                backendTreasury,
                protocolTreasuryAppId,
                limitOrder.assetOutId,
                limitOrder.registryAppId
            ],
            onComplete: OnApplicationComplete.NoOpOC,
        })


        // close out the escrow
        let closeOutParams = {...params}
        closeOutParams.fee = 3000
        closeOutParams.flatFee = true

        composer.addMethodCall({
            appID: limitOrder.registryAppId,
            method: RegistryAppAPI.getMethod(BACKEND_CLOSE_ESCROW),
            sender: this.account.addr,
            suggestedParams: closeOutParams,
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
}

async function fetchAllOrders(indexer: Indexer, chain: string, protocolVersion: number, registryAppId ?: number):
    Promise<LimitOrderParams[]> {
    if (!registryAppId) {
        registryAppId = RegistryAppAPI.getAppId(chain, protocolVersion)
    }
    let accounts = []
    let nextToken = null
    while (true) {
        const appInfo = await indexer.searchAccounts()
            .applicationID(registryAppId)
            .limit(100)
            .nextToken(nextToken)
            .do()
        accounts = [...accounts, ...appInfo['accounts']]
        if ('next-token' in appInfo) {
            nextToken = appInfo['next-token']
        } else {
            break
        }
    }
    return accounts.map((account) => DeflexLimitOrderFillerClient.limitOrderFromAccount(account))
}