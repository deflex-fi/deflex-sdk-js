import Api from "./api";
import {ABIContract} from "algosdk";

export const USER_INITIALIZE = 'User_initialize'
export const USER_OPT_INTO_ASSETS = 'User_opt_into_assets'
export const USER_OPT_OUT_ASSETS = 'User_opt_out_assets'
export const USER_CREATE_ORDER = 'User_create_order'
export const USER_CANCEL_ORDER = 'User_cancel_order'
export const BACKEND_FILL_ORDER_INITIALIZE = 'Backend_fill_order_initialize'
export const BACKEND_FILL_ORDER_FINALIZE = 'Backend_fill_order_finalize'

const __contract = {
    "name": "Deflex Limit Order Protocol",
    "desc": "Interface for the limit order app",
    "methods": [
        {
            "name": "User_initialize",
            "desc": "Fund the limit order app with its minimum balance",
            "args": [
                {"type": "pay", "name": "funding_txn", "desc": "Txn to fund the app"}
            ],
            "returns": {"type": "void"}
        },
        {
            "name": "User_opt_into_assets",
            "desc": "Opt the limit-order app into all assets in the foreign assets array",
            "args": [
                {
                    "type": "pay",
                    "name": "funding_txn",
                    "desc": "A payment transaction to fund the app with 100'000 microALGO per asset in the foreign assets array"
                }
            ],
            "returns": {"type": "void"}
        },
        {
            "name": "User_opt_out_assets",
            "desc": "Opt the smart contract out of an asset",
            "args": [],
            "returns": {"type": "void"}
        },
        {
            "name": "User_create_order",
            "desc": "Create a limit order and store the order's details in the escrow's local state",
            "args": [
                {"type": "appl", "name": "escrow_optin_txn", "desc": "A transaction that opts the escrow into the app"},
                {
                    "type": "pay",
                    "name": "network_fee_txn",
                    "desc": "A transaction that funds the app with 0.1 ALGO as compensation for the backend's network fees"
                },
                {"type": "txn", "name": "funding_txn", "desc": "A transaction that funds the app with amount_in"},
                {"type": "account", "name": "escrow", "desc": "The address of the escrow account"},
                {"type": "account", "name": "beneficiary", "desc": "The beneficiary that receives the output"},
                {
                    "type": "account",
                    "name": "platform_treasury",
                    "desc": "The address of the platform's treasury account"
                },
                {"type": "asset", "name": "asset_in", "desc": "The input asset (0 if ALGO)"},
                {"type": "uint64", "name": "amount_in", "desc": "Amount in base units of the input asset"},
                {"type": "asset", "name": "asset_out", "desc": "The output asset (0 if ALGO)"},
                {"type": "uint64", "name": "amount_out", "desc": "Amount in base units of the output asset"},
                {"type": "uint64", "name": "expiration_date", "desc": "Unix timestamp when order expires"},
                {
                    "type": "uint64",
                    "name": "fee_bps",
                    "desc": "The fee bps shared equally between platform, backend, and protocol. Must be at least 6."
                },
                {"type": "application", "name": "registry_app", "desc": "ID of the the registry app"},
                {
                    "type": "address",
                    "name": "backend_address",
                    "desc": "The address of the backend that can fill this order or the zero-address if any backend can fill the order"
                },
                {"type": "string", "name": "note", "desc": "A free-text note"}
            ],
            "returns": {"type": "void"}
        },
        {
            "name": "User_cancel_order",
            "desc": "Cancel a limit order",
            "args": [
                {"type": "account", "name": "escrow", "desc": "The address of the escrow account"},
                {"type": "account", "name": "beneficiary", "desc": "The beneficiary that receives the input"},
                {"type": "asset", "name": "asset_in", "desc": "The input asset (0 if ALGO)"},
                {"type": "application", "name": "registry_app_id", "desc": "ID of the the registry app"}
            ],
            "returns": {"type": "void"}
        },
        {
            "name": "Backend_fill_order_initialize",
            "desc": "Indicate that a limit order is filled by the following transactions. This must be evantualluy followed by a call to Backend_fill_order_finalize.",
            "args": [
                {"type": "account", "name": "escrow", "desc": "The address of the escrow account"},
                {"type": "account", "name": "router", "desc": "The address of the account that fills this order"},
                {"type": "asset", "name": "asset_in", "desc": "The input asset (0 if ALGO)"},
                {"type": "asset", "name": "asset_out", "desc": "The output asset (0 if ALGO)"}
            ],
            "returns": {"type": "void"}
        },
        {
            "name": "Backend_fill_order_finalize",
            "desc": "Finalize filling an order after a Backend_fill_order_initialize call",
            "args": [
                {"type": "account", "name": "escrow", "desc": "The address of the escrow account"},
                {"type": "account", "name": "beneficiary", "desc": "The beneficiary that receives the output"},
                {
                    "type": "account",
                    "name": "platform_treasury",
                    "desc": "The address of the platform's treasury account"
                },
                {
                    "type": "account",
                    "name": "backend_treasury",
                    "desc": "The address of the backend's treasury account"
                },
                {"type": "application", "name": "protocol_treasury", "desc": "The ID of the protocol's treasury app"},
                {"type": "asset", "name": "asset_out", "desc": "The output asset (0 if ALGO)"},
                {"type": "application", "name": "registry_app", "desc": "ID of the the registry app"}
            ],
            "returns": {"type": "void"}
        },
        {
            "name": "User_delete_app",
            "desc": "Delete the app and close the app account to the user. This function must be called with OnCompletion=DeleteApplication.",
            "args": [],
            "returns": {"type": "void"}
        }
    ]
}


export default class LimitOrderAppAPI {

    static getMethod(name: string) {
        return Api.getMethodByName(new ABIContract(__contract), name)
    }
}