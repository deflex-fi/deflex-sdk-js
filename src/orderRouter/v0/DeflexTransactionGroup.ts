import DeflexTransaction from "./DeflexTransaction";

export default class DeflexTransactionGroup {
    public txns: Array<DeflexTransaction>

    constructor(txns) {
        this.txns = txns
    }

    static fromApiResponse(apiResponse) {
        return new DeflexTransactionGroup(apiResponse.txns.map(txn => DeflexTransaction.fromApiResponse(txn)))
    }
}