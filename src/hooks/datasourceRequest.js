import { withPagingInputs } from "./paging.js";

export function buildDatasourceFetchInputs({ inputParameters = {}, filter = {}, pagingValues = null } = {}) {
    return {
        ...withPagingInputs(inputParameters, pagingValues),
        ...(filter || {}),
    };
}

export function buildDatasourceFetchPayload({inputParameters = {}, filter = {}, pagingValues = null, cache = null} = {}) {
    return {
        inputs: buildDatasourceFetchInputs({inputParameters, filter, pagingValues}),
        ...(cache && typeof cache === 'object' && !Array.isArray(cache) ? {cache: {...cache}} : {}),
    };
}
