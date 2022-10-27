import DEXQuote from "./DexQuote";
import DeflexRoute from "./DeflexRoute";



export default class DeflexQuote {
    public quote: Number|null
    public profitAmount: Number|null
    public profitASAID: Number|null
    public priceBaseline: Number|null
    public route: Array<DeflexRoute>
    public quotes: Array<DEXQuote>
    public requiredAppOptIns: Array<Number>
    public txnPayload: Object|null
    public protocolFees: {[key: string]: Number }
    public flattenedRoute: {[key: string]: Number}

    constructor(quote,
                profitAmount,
                profitASAID,
                priceBaseline,
                route,
                quotes,
                requiredAppOptIns,
                txnPayload,
                protocolFees,
                flattenedRoute) {
        this.quote = quote
        this.profitAmount = profitAmount
        this.profitASAID = profitASAID
        this.priceBaseline = priceBaseline
        this.route = route
        this.quotes = quotes
        this.requiredAppOptIns = requiredAppOptIns
        this.txnPayload = txnPayload
        this.protocolFees = protocolFees
        this.flattenedRoute = flattenedRoute
    }

    static fromAPIResponse(apiResponse) : DeflexQuote {
        return new DeflexQuote(
            apiResponse.quote === '' ? null : parseFloat(apiResponse.quote),
            apiResponse.quote === '' ? null : apiResponse.profit.amount,
            apiResponse.quote === '' ? null : apiResponse.profit.asa.id,
            apiResponse.quote === '' ? null : apiResponse.priceBaseline,
            apiResponse.route.map((_route) => DeflexRoute.fromApiResponse(_route)),
            apiResponse.quotes.map((quote) => DEXQuote.fromApiResponse(quote)),
            apiResponse.requiredAppOptIns,
            apiResponse.quote === '' ? null : apiResponse.txnPayload,
            apiResponse.protocolFees,
            apiResponse.flattenedRoute
        )
    }


}