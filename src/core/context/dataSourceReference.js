// Only locally unresolved metadata references get this type. A server error
// with the same code is still a real request failure, not a render omission.
export class MissingDataSourceReferenceError extends Error {
    constructor(dataSourceRef = '', identity = null) {
        super(`DataSource not found: ${dataSourceRef}`);
        this.name = 'MissingDataSourceReferenceError';
        this.code = 'DataSourceNotFound';
        this.dataSourceRef = dataSourceRef;
        if (identity && typeof identity === 'object' && !Array.isArray(identity)) this.identity = identity;
    }
}
