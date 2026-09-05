export const normalizeCurrencyCode = (value, fallback = 'USD') => {
    const code = String(value || '').trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : fallback;
};

export const currencyInputIcon = (value) => {
    const code = normalizeCurrencyCode(value);
    if (['USD', 'CAD', 'AUD', 'NZD'].includes(code)) return 'dollar';
    if (code === 'EUR') return 'euro';
    if (code === 'GBP') return 'pound';
    if (code === 'JPY' || code === 'CNY') return 'yen';
    return undefined;
};
