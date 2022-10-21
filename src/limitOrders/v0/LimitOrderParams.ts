import {ALGO_ZERO_ADDRESS, LIMIT_ORDER_MIN_FEE_BPS} from "../../constants";

export default class LimitOrderParams {
    userAddress: string
    beneficiaryAddress: string
    limitOrderAppId: number
    registryAppId: number
    platformTreasuryAddress: string
    assetInId: number
    assetOutId: number
    amountIn: number
    amountOut: number
    expirationDate: number = Number.MAX_SAFE_INTEGER
    note: string = ''
    feeBps: number = LIMIT_ORDER_MIN_FEE_BPS
    backendAddress: string = ALGO_ZERO_ADDRESS
    escrowAddress: string = null

    constructor(userAddress: string,
                beneficiaryAddress: string,
                limitOrderAppId: number,
                registryAppId: number,
                platformTreasuryAddress: string,
                assetInId: number,
                assetOutId: number,
                amountIn: number,
                amountOut: number,
                expirationDate: number = Number.MAX_SAFE_INTEGER,
                note: string = '',
                feeBps: number = LIMIT_ORDER_MIN_FEE_BPS,
                backendAddress: string = ALGO_ZERO_ADDRESS,
                escrowAddress: string = null) {
        this.userAddress = userAddress
        this.beneficiaryAddress = beneficiaryAddress
        this.limitOrderAppId = limitOrderAppId
        this.registryAppId = registryAppId
        this.platformTreasuryAddress = platformTreasuryAddress
        this.assetInId = assetInId
        this.assetOutId = assetOutId
        this.amountIn = amountIn
        this.amountOut = amountOut
        this.expirationDate = expirationDate
        this.note = note
        this.feeBps = feeBps
        this.backendAddress = backendAddress
        this.escrowAddress = escrowAddress
    }
}