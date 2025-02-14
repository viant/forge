



// Helper function to compare two arrays
export  function arrayEquals(a = [], b = []) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}



//isMapEquals
export function isMapEquals(map1 = {}, map2 = {}) {
    const keys1 = Object.keys(map1);
    const keys2 = Object.keys(map2);

    if (keys1.length !== keys2.length) {
        return false;
    }

    for (const key of keys1) {
        if (map1[key] !== map2[key]) {
            return false;
        }
    }

    return true;
}
