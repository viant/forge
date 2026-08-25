function splitText(value = '') {
    const text = String(value || '');
    const trailingNewline = text.endsWith('\n');
    return { lines: text.replace(/\n$/, '').split(/\r?\n/), trailingNewline };
}

export function derivePreviousTextFromUnifiedDiff(currentText = '', unifiedDiff = '') {
    const diffLines = String(unifiedDiff || '').split(/\r?\n/);
    const { lines: currentLines, trailingNewline } = splitText(currentText);
    const previous = [];
    let currentIndex = 0;
    let foundHunk = false;

    for (let index = 0; index < diffLines.length; index += 1) {
        const header = diffLines[index].match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
        if (!header) continue;
        foundHunk = true;
        const newStart = Math.max(0, Number(header[1] || 1) - 1);
        while (currentIndex < newStart && currentIndex < currentLines.length) {
            previous.push(currentLines[currentIndex++]);
        }
        index += 1;
        for (; index < diffLines.length && !diffLines[index].startsWith('@@ '); index += 1) {
            const line = diffLines[index];
            if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('\\')) continue;
            if (line.startsWith('+')) {
                currentIndex += 1;
            } else if (line.startsWith('-')) {
                previous.push(line.slice(1));
            } else if (line.startsWith(' ')) {
                previous.push(currentLines[currentIndex] ?? line.slice(1));
                currentIndex += 1;
            }
        }
        index -= 1;
    }
    if (!foundHunk) return '';
    while (currentIndex < currentLines.length) previous.push(currentLines[currentIndex++]);
    const result = previous.join('\n');
    return trailingNewline && result ? result + '\n' : result;
}
