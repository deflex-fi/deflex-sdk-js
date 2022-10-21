import {PROTOCOL_TREASURY_APP_IDS} from "../../constants";
import Api from "./api";
import {ABIContract} from "algosdk";

export const USER_OPT_INTO_ASSETS = 'User_opt_into_assets'

const __contract = {
    "name": "Protocol-Treasury App",
    "desc": "This treasury app collects the protoco's fees",
    "methods": [
        {
            "name": "User_opt_into_assets",
            "desc": "Opt the smart contract into all assets in the foreign assets array",
            "args": [
                {
                    "type": "pay",
                    "name": "min_balance_increase",
                    "desc": "This covers the increased minimum balance for the assets (each asset requires 0.1 ALGO)"
                }
            ],
            "returns": {"type": "void"}
        }
    ]
}

export default class ProtocolTreasuryAppAPI {

    static getAppId(chain: string) {
        return PROTOCOL_TREASURY_APP_IDS[chain]
    }

    static getMethod(name: string) {
        return Api.getMethodByName(new ABIContract(__contract), name)
    }
}