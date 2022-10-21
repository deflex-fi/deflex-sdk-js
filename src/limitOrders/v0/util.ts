import {Algodv2} from "algosdk";
import {ALGO_ASSET_ID} from "../../constants";


export async function isOptedIntoAsset(algodClient: Algodv2, address: string, assetId: number) {
    if (assetId === ALGO_ASSET_ID) {
        return true
    }
    const accountInfo = await algodClient.accountInformation(address).do()
    const assets = accountInfo['assets']
    for (let i = 0; i < assets.length; i++) {
        if (parseInt(assets[i].id) === assetId) {
            return true
        }
    }
    return false
}

export function getStateInt(state: object, key: string) {
    key = Buffer.from((new TextEncoder()).encode(key)).toString('base64')
    if (!(key in state)) {
        throw new Error(`could not find key ${key} in state`)
    }
    return state[key]['uint']
}

export function getStateBytes(state: object, key: string) {
    key = Buffer.from((new TextEncoder()).encode(key)).toString('base64')
    if (!(key in state)) {
        throw new Error(`could not find key ${key} in state`)
    }
    return Buffer.from(state[key]['bytes'], 'base64')
}