import {Algodv2, decodeUint64, decodeUnsignedTransaction, encodeAddress, TransactionType} from "algosdk";
import {
    DEFLEX_FIXED_FEE_TXN_NOTE,
    DEFLEX_MANAGER_ADDRESS,
    LEGACY_ORDER_ROUTER_APP_IDS,
    TYPE_FIXED_INPUT,
    TYPE_FIXED_OUTPUT
} from "../../constants";
import DeflexTransactionGroup from "./DeflexTransactionGroup";
import DeflexQuote from "./DeflexQuote";

export async function performSafetyChecks(algod: Algodv2,
                                          transactionGroup: DeflexTransactionGroup,
                                          address: string,
                                          quote: DeflexQuote,
                                          slippage: Number,
                                          chain: string): Promise<void> {

    const deflexManagerAccountInfo = await algod.accountInformation(DEFLEX_MANAGER_ADDRESS).do()
    const deflexCreatedAppIds = deflexManagerAccountInfo['created-apps'].map(app => app.id)

    const txns = transactionGroup.txns.map((deflexTxn) =>
        decodeUnsignedTransaction(new Uint8Array(Buffer.from(deflexTxn.data, 'base64'))))

    let sentAmountSum = 0
    for (let i = 0; i < txns.length; i++) {
        const txn = txns[i]
        // ignore any txns that don't originate from the address
        if (encodeAddress(txn.from.publicKey) !== address) {
            continue
        }
        if (txn.reKeyTo) {
            throw new Error('Transaction cannot have rekeyTo set!')
        }
        if (txn.closeRemainderTo) {
            throw new Error('Transaction cannot have closeRemainderTo set!')
        }

        // make sure hardcoded transactions are payments and don't exceed 0.1 ALGO
        if ((new TextDecoder()).decode(txn.note) === DEFLEX_FIXED_FEE_TXN_NOTE) {
            if (txn.type !== TransactionType.pay) {
                throw new Error('Fixed fee transaction must be payment!')
            }
            if (txn.amount > 101000) {
                throw new Error('Fixed fee transaction amount cannot exceed 100000 microALGO!')
            }
            continue
        }

        // check there are no unexpected payments or asset transfers
        if (txn.type === TransactionType.axfer && quote.fromASAID !== txn.assetIndex && 
            !(quote.toASAID === txn.assetIndex && txn.amount === 0)) {
            throw new Error('Unexpected asset transfer transaction!')
        }
        if (txn.type === TransactionType.pay && quote.fromASAID !== 0) {
            throw new Error('Unexpected payment transaction!')
        }

        // sum to check total sent
        if (txn.type === TransactionType.pay || txn.type === TransactionType.axfer) {
            sentAmountSum += Number(txn.amount)
        }
    }
    const expectedSentAmount = quote.type === TYPE_FIXED_INPUT ?
        quote.amountIn : Math.floor((Number(quote.quote) * 100) / (100 - Number(slippage)))
    if (sentAmountSum > (Number(expectedSentAmount) + 1)) {
        throw new Error(`Sent amount exceeds expected sent amount by ${sentAmountSum - Number(expectedSentAmount)}!`)
    }

    // OUTPUT safety checks

    // loop over each txn group and make sure they go to a known protocol
    const legacyDeflexOrderRouterAppId = LEGACY_ORDER_ROUTER_APP_IDS[chain]

    let receivedAmountSum = 0

    // sum all direct payments or asset transfers to user address
    txns.filter(txn => {
        if (!txn.to || encodeAddress(txn.to.publicKey) !== address) {
            return false
        }
        return (quote.toASAID === 0 && txn.type === TransactionType.pay) ||
            (quote.toASAID === txn.assetIndex && txn.type === TransactionType.axfer)
    }).map(txn => {
        receivedAmountSum += Number(txn.amount)
    })

    // sum order router finalize
    txns.filter((txn) => {
        return (txn.appIndex === legacyDeflexOrderRouterAppId || deflexCreatedAppIds.includes(txn.appIndex)) &&
            txn.appArgs.length > 0 &&
            Buffer.from((new TextDecoder()).decode(txn.appArgs[0])).toString('base64') === '77+9MO+/vR8=' && // finalize
            txn.appForeignAssets[decodeUint64(txn.appArgs[2], 'safe')] === quote.toASAID && // output is to ASA
            // beneficiary is user
            ((Number(decodeUint64(txn.appArgs[5], 'safe')) === 0 && encodeAddress(txn.from.publicKey) === address) ||
                encodeAddress(txn.appAccounts[decodeUint64(txn.appArgs[5], 'safe') - 1].publicKey) === address)
    }).map(txn => {
        receivedAmountSum += decodeUint64(txn.appArgs[3], 'safe')
    })

    const expectedReceiveAmount = quote.type === TYPE_FIXED_OUTPUT ?
        quote.amountIn : Math.floor((Number(quote.quote) * (100 - Number(slippage))) / 100)

    if (receivedAmountSum < (Number(expectedReceiveAmount) - 1)) {
        throw new Error(`Receives amount subceeds expected sent amount by ${Number(expectedReceiveAmount) - receivedAmountSum}!`)
    }
}