import DeflexTransactionSignature from "./DeflexTransactionSignature";

export default class DeflexTransaction {
    public data : String
    public group: String
    public logicSigBlob: Uint8Array|boolean
    public signature: DeflexTransactionSignature|boolean

    constructor(data, group, logicSigBlob, signature) {
        this.data = data
        this.group = group
        this.logicSigBlob = logicSigBlob
        this.signature = signature
    }

    static fromApiResponse(apiResponse) {
        return new DeflexTransaction(apiResponse.data,
            apiResponse.group,
            apiResponse.logicSigBlob !== false
                ? Uint8Array.from(Object.values(apiResponse.logicSigBlob)) : false,
            apiResponse.signature !== false
                ? DeflexTransactionSignature.fromApiResponse(apiResponse.signature) : false,
        )
    }
}