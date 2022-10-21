import {REGISTRY_APP_IDS} from "../../constants";
import Api from "./api";
import {ABIContract} from "algosdk";

export const BACKEND_CLOSE_ESCROW = 'Backend_close_escrow'

const __contract = {
    "name": "Limit-Order App Registry",
    "methods": [
        {
            "name": "Escrow_opt_in",
            "args": [
                {"type": "application", "name": "limit_order_app", "desc": "The ID of the limit order app"}
            ],
            "returns": {
                "type": "void"
            },
            "desc": "Opt the escrow into the registry. This function must be called with OnCompletion=OptIn."
        },
        {
            "name": "Escrow_close_out",
            "args": [
                {"type": "application", "name": "limit_order_app", "desc": "The ID of the limit order app"},
                {"type": "uint64", "name": "outcome", "desc": "0 if the order was filled, 1 if cancelled"}
            ],
            "returns": {
                "type": "void"
            },
            "desc": "Close the escrow out of the registry. This function must be called with OnCompletion=CloseOut."
        },
        {
            "name": "Backend_close_escrow",
            "args": [
                {"type": "application", "name": "limit_order_app", "desc": "The ID of the limit order app"},
                {"type": "account", "name": "escrow", "desc": "The address of an escrow account"},
                {"type": "account", "name": "user", "desc": "The address that the escrow is closed to"}
            ],
            "returns": {
                "type": "void"
            },
            "desc": "Close the escrow back to the user"
        }
    ],
    "desc": "The registry app is used to index all limit orders for the protocol, so that orders can be discovered for filling.",
    "networks": {}
}

export default class RegistryAppAPI {

    static getAppId(chain: string) {
        return REGISTRY_APP_IDS[chain]
    }

    static getMethod(name: string) {
        return Api.getMethodByName(new ABIContract(__contract), name)
    }
}