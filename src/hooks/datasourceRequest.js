import { withPagingInputs } from "./paging.js";

export function buildDatasourceFetchInputs({ inputParameters = {}, filter = {}, pagingValues = null } = {}) {
    return {
        ...withPagingInputs(inputParameters, pagingValues),
        ...(filter || {}),
    };
}
