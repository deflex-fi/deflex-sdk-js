import DeflexPathElement from "./DeflexPathElement";

export default class DeflexRoute {
    public percent: Number
    public path: Array<DeflexPathElement>

    constructor(percent, path) {
        this.percent = percent
        this.path = path
    }

    static fromApiResponse(apiResponse) : DeflexRoute {
        return new DeflexRoute(
            apiResponse.percentage,
            apiResponse.path.map((_path) => DeflexPathElement.fromAPIResponse(_path))
        )
    }

}