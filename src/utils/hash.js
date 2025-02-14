

export  function generateIntHash(inputParameters) {
    function serialize(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return String(obj); // Convert primitives to string
        }

        const sortedKeys = Object.keys(obj).sort();
        return sortedKeys.map(key => `${key}:${serialize(obj[key])}`).join('|');
    }

    const serializedString = serialize(inputParameters);

    let hash = 0;
    for (let i = 0; i < serializedString.length; i++) {
        const char = serializedString.charCodeAt(i);
        hash = (hash * 31 + char) | 0; // Use a prime number (31) for hash computation
    }

    return hash >>> 0; // Convert to unsigned integer
}

