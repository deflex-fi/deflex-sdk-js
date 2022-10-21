
export default class Api {
    static getMethodByName(contract: object, name: string) {
        const m = contract['methods'].find((mt) => {
            return mt.name == name
        })
        if (m === undefined)
            throw Error("Method undefined: " + name)
        return m
    }
}