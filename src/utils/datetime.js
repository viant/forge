// Library: dateUtils.js
export const getZoneOffset = () => {
    const now = new Date();
    const offset = (now.getTimezoneOffset() / 60);
    return ('' + offset).padStart(2, '0').padEnd(4, '0');
};

export const toUTC = (date) => {
    if (!date) {
        return null;
    }
    return date.getFullYear() + '-' +
        ('' + (date.getMonth() + 1)).padStart(2, '0') + '-' +
        ('' + date.getDate()).padStart(2, '0') + 'T' +
        ('' + date.getHours()).padStart(2, '0') + ':' +
        ('' + date.getMinutes()).padStart(2, '0') + ':' +
        ('' + date.getSeconds()).padStart(2, '0') + 'Z';
};

export const fromUTC = (value) => {
    const offset = getZoneOffset();
    if (value === null) {
        const now = new Date();
        const inHour = new Date();
        inHour.setHours(inHour.getHours() + 1 + (now.getTimezoneOffset() / 60));
        return inHour;
    }

    if (value.endsWith('Z')) {
        value = value.replace('Z', `-${offset}`);
    }
    return new Date(value);
};




/**
 * Parse an English-like phrase describing a time offset from "now."
 * Returns a new JavaScript Date object.
 *
 * Supported:
 *   - Direct keywords: "now", "yesterday", "tomorrow"
 *   - Template: [timeValueToken] [durationToken] [modifier] [IN tz?]
 *       * timeValueToken is numeric (e.g. "2", "50")
 *       * durationToken: "days", "hours", "minutes", "seconds"
 *         (if none found, defaults to hours)
 *       * modifier synonyms:
 *           - Past (negative offset): "ago", "before", "earlier", "in the past", "past"
 *           - Future (positive offset): "ahead", "after", "later", "onward", "in the future"
 *       * If it includes "in utc" or ends with "utc", interpret final date in UTC.
 *
 * Example calls:
 *   timeAt("tomorrow");
 *   timeAt("2 days ago");
 *   timeAt("50 hours ahead");
 *   timeAt("1 day before in UTC");
 */
export function timeAt(literal) {
    // 1) Start from now
    const baseTime = new Date();

    // Clean up input
    let str = literal ? literal.toLowerCase().trim() : "";
    // We'll work in milliseconds offset from baseTime
    let offsetMs = 0;

    // -----------------------------
    // 2) Handle special keywords
    // -----------------------------
    if (str === "now") {
        // offsetMs = 0 => no change
    }
    else if (str.indexOf("yesterday") !== -1) {
        // -1 day
        offsetMs = -1 * 24 * 60 * 60 * 1000;
    }
    else if (str.indexOf("tomorrow") !== -1) {
        // +1 day
        offsetMs = 1 * 24 * 60 * 60 * 1000;
    }
    else {
        // -----------------------------
        // 3) Parse [timeValueToken] [durationToken] [modifier]
        // -----------------------------

        // a) Find the first numeric segment => timeValue
        let timeValue = 0;
        let numberStart = -1;
        let numberEnd = -1;

        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            // is digit?
            if (ch >= '0' && ch <= '9') {
                numberStart = i;
                // keep going until we find a non-digit
                while (i < str.length && str[i] >= '0' && str[i] <= '9') {
                    i++;
                }
                numberEnd = i; // first index after the number
                break;
            }
        }
        // if found a numeric substring
        if (numberStart !== -1 && numberEnd !== -1) {
            const numStr = str.substring(numberStart, numberEnd).trim();
            const parsed = parseInt(numStr, 10);
            if (!isNaN(parsed)) {
                timeValue = parsed;
            }
        }

        // b) Identify the duration token: "day"/"days", "hour"/"hours", "minute"/"minutes", "second"/"seconds"
        //    If none found, we might default to hours if timeValue > 0
        let multiplier = 0;

        const hasDays    = (str.indexOf("day") !== -1);
        const hasHours   = (str.indexOf("hour") !== -1);
        const hasMinutes = (str.indexOf("minute") !== -1);
        const hasSeconds = (str.indexOf("second") !== -1);

        if (hasDays) {
            multiplier = 24 * 60 * 60 * 1000;
        } else if (hasHours) {
            multiplier = 60 * 60 * 1000;
        } else if (hasMinutes) {
            multiplier = 60 * 1000;
        } else if (hasSeconds) {
            multiplier = 1000;
        } else if (timeValue > 0) {
            // default to hours if not recognized
            multiplier = 60 * 60 * 1000;
        }

        // c) Check synonyms for past/future
        const negativeSynonyms = ["ago","before","earlier","in the past","past"];
        const positiveSynonyms = ["ahead","after","later","onward","in the future"];

        // Default sign = 0 => means no offset (if no numeric found).
        // But if we have a numeric timeValue, let's guess + if we see no synonyms.
        let offsetSign = (timeValue > 0) ? 1 : 0;

        // Check negative
        for (let i=0; i<negativeSynonyms.length; i++) {
            if (str.indexOf(negativeSynonyms[i]) !== -1) {
                offsetSign = -1;
                break;
            }
        }
        // If still zero or +1, check positive
        if (offsetSign >= 0) {
            for (let i=0; i<positiveSynonyms.length; i++) {
                if (str.indexOf(positiveSynonyms[i]) !== -1) {
                    offsetSign = 1; // ensure positive
                    break;
                }
            }
        }

        // final offset in ms
        offsetMs = offsetSign * timeValue * multiplier;
    }

    // -----------------------------
    // 4) Apply offset to baseTime
    // -----------------------------
    let finalTime = new Date(baseTime.getTime() + offsetMs);

    // -----------------------------
    // 5) If phrase includes "in utc" or ends with "utc",
    //    interpret finalTime in UTC
    // -----------------------------
    if (str.indexOf("in utc") !== -1 || str.endsWith("utc")) {
        finalTime = new Date(Date.UTC(
            finalTime.getUTCFullYear(),
            finalTime.getUTCMonth(),
            finalTime.getUTCDate(),
            finalTime.getUTCHours(),
            finalTime.getUTCMinutes(),
            finalTime.getUTCSeconds(),
            finalTime.getUTCMilliseconds()
        ));
    }

    return finalTime;
}

