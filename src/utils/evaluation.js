
/**
 * Evaluate evaluates if an item meets all the given criteria.
 * @param {Object} item - The data item to evaluate.
 * @param {Array} criteria - An array of criterion objects.
 * @param {Array} columns - The array of configured columns.
 * @returns {Boolean} - True if the item meets all criteria, false otherwise.
 */
export const evaluate = (item, criteria, columns) => {
    return criteria.every((criterion) => {
        const column = columns.find((col) => col.id === criterion.columnId);
        if (!column) return false;
        const value = item[column.id];

        switch (criterion.operator) {
            case '=':
                return value === criterion.value;
            case '!=':
                return value != criterion.value;
            case '>':
                return value > criterion.value;
            case '<':
                return value < criterion.value;
            case '>=':
                return value >= criterion.value;
            case '<=':
                return value <= criterion.value;
            case 'contains':
                return value.includes(criterion.value);
            default:
                return false;
        }
    });
};