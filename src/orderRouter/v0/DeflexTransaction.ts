export default class DeflexTransaction {
    public data : String
    public group: String
    public logicSigBlob: Uint8Array|boolean

    constructor(data, group, logicSigBlob) {
        this.data = data
        this.group = group
        this.logicSigBlob = logicSigBlob
    }

    static fromApiResponse(apiResponse) {
        return new DeflexTransaction(apiResponse.data, apiResponse.group, apiResponse.logicSigBlob !== false ? Uint8Array.from(Object.values(apiResponse.logicSigBlob)) : false)
    }
}