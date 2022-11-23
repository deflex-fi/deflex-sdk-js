export default class DeflexTransactionSignature {
    public type: String
    public value: Uint8Array

    constructor(type, value) {
        this.type = type
        this.value = value
    }

    static fromApiResponse(apiResponse) {
        return new DeflexTransactionSignature(apiResponse.type, Uint8Array.from(Object.values(apiResponse.value)))
    }
}