export const CHAIN_MAINNET = 'mainnet'
export const CHAIN_TESTNET = 'testnet'

export const ALGO_ASSET_ID = 0
export const ALGO_ZERO_ADDRESS = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'

// ORDER ROUTER
export const TYPE_FIXED_INPUT = 'fixed-input'
export const TYPE_FIXED_OUTPUT = 'fixed-output'
export const FETCH_QUOTE_API = 'fetchQuote'
export const FETCH_EXECUTE_SWAP_TXNS_API = 'fetchExecuteSwapTxns'
export const ORDER_ROUTER_DEFAULT_FEE_BPS = 4
export const DEFAULT_MAX_GROUP_SIZE = 16

export const DEFLEX_FIXED_FEE_TXN_NOTE = 'deflex-fixed-fee'

export const ORDER_ROUTER_APP_IDS = {
    [CHAIN_MAINNET]: 951874839,
    [CHAIN_TESTNET]: 145324831,
}

// LIMIT ORDERS
export const PROTOCOL_TREASURY_APP_IDS = {
    [CHAIN_MAINNET]: 949203488,
    [CHAIN_TESTNET]: 123803250,
}

export const REGISTRY_APP_IDS = {
    [CHAIN_MAINNET]: 949209670,
    [CHAIN_TESTNET]: 123803795,
}
export const LIMIT_ORDER_MIN_FEE_BPS = 6
