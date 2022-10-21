import DeflexRoute from "./DeflexRoute";
import DEXQuote from "./DexQuote";

export default class DeflexPathElement {
    public name: String
    public inputASAID: Number
    public outputASAID: Number

    constructor(name, inputASAID, outputASAID) {
        this.name = name
        this.inputASAID = inputASAID
        this.outputASAID = outputASAID
    }

    static fromAPIResponse(apiResponse) : DeflexPathElement {
        return new DeflexPathElement(
            apiResponse.name,
            apiResponse.in.id,
            apiResponse.out.id
        )
    }
}