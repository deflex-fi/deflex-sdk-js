export default class DEXQuote {
    public name: String
    public value: String

    constructor(name, value) {
        this.name = name
        this.value = value
    }

    static fromApiResponse(apiResponse) : DEXQuote {
        return new DEXQuote(apiResponse.name, apiResponse.value)
    }

}