export const isTablePaginationItem = item => item?.type === 'pagination' || item?.id === 'pagination';
export function tablePrimaryToolbarItems(items = []) {
    return items.filter(item => !isTablePaginationItem(item)).map(item => {
        if (!['footer','bottom'].includes(String(item?.placement || '').toLowerCase())) return item;
        const {placement, ...primary} = item;
        return {...primary, align: primary.align || 'left'};
    });
}
