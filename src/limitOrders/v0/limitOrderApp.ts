import {CHAIN_MAINNET} from "../../constants";

export const GLOBAL_STATE_INTS = 6
export const GLOBAL_STATE_BYTES = 0

export const LOCAL_STATE_INTS = 10
export const LOCAL_STATE_BYTES = 5

export const EXTRA_PROGRAM_PAGES = 1

export const MINIMUM_BALANCE_FOR_OPT_IN = 100000 +
    (25000 + 3500) * LOCAL_STATE_INTS +
    (25000 + 25500) * LOCAL_STATE_BYTES

export const MINIMUM_BALANCE_FOR_ACCOUNT = 100000

const LIMIT_ORDER_TESTNET_APPROVAL = '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'
const LIMIT_ORDER_TESTNET_CLEAR = 'BzEbgQASQAABAIEBQw=='

const LIMIT_ORDER_MAINNET_APPROVAL = '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'
const LIMIT_ORDER_MAINNET_CLEAR = 'BzEbgQASQAABAIEBQw=='

export default class LimitOrderApp {

    static approvalProgramBytes(chain: string) {
        if (chain === CHAIN_MAINNET) {
            return new Uint8Array(Buffer.from(LIMIT_ORDER_MAINNET_APPROVAL, 'base64'))
        } else {
            return new Uint8Array(Buffer.from(LIMIT_ORDER_TESTNET_APPROVAL, 'base64'))
        }
    }

    static clearStateProgramBytes(chain: string) {
        if (chain === CHAIN_MAINNET) {
            return new Uint8Array(Buffer.from(LIMIT_ORDER_MAINNET_CLEAR, 'base64'))
        } else {
            return new Uint8Array(Buffer.from(LIMIT_ORDER_TESTNET_CLEAR, 'base64'))
        }
    }
}