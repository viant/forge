package textwrap

import (
	"regexp"
	"strings"
	"unicode"
)

var htmlBreakPattern = regexp.MustCompile(`(?i)<br\s*/?>`)

// Lines mirrors Forge's reportPrintModel wrapping contract. It uses only the
// available width, font size, and text content. Explicit HTML breaks become
// newlines; whitespace, hyphen, and taxonomy separators are break points.
func Lines(text string, width, fontSize float64) []string {
	text = htmlBreakPattern.ReplaceAllString(text, "\n")
	if text == "" {
		return nil
	}
	maxChars := int(width / maxFloat(4, fontSize*0.56))
	if maxChars < 8 {
		maxChars = 8
	}
	var result []string
	for _, paragraph := range strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n") {
		paragraph = strings.TrimSpace(paragraph)
		if paragraph == "" {
			result = append(result, "")
			continue
		}
		current := ""
		for _, token := range breakTokens(paragraph) {
			candidate := token
			if current != "" {
				candidate = current + token
			}
			if current == "" || len([]rune(candidate)) <= maxChars {
				current = candidate
				continue
			}
			result = appendChunk(result, strings.TrimSpace(current), maxChars)
			current = strings.TrimLeftFunc(token, unicode.IsSpace)
		}
		result = appendChunk(result, strings.TrimSpace(current), maxChars)
	}
	return result
}

func breakTokens(value string) []string {
	var result []string
	var current strings.Builder
	flush := func() {
		if current.Len() == 0 {
			return
		}
		result = append(result, current.String())
		current.Reset()
	}
	for _, char := range value {
		current.WriteRune(char)
		if unicode.IsSpace(char) || char == '-' || char == '>' {
			flush()
		}
	}
	flush()
	return result
}

func appendChunk(lines []string, chunk string, maxChars int) []string {
	if chunk == "" {
		return lines
	}
	runes := []rune(chunk)
	for len(runes) > maxChars {
		lines = append(lines, string(runes[:maxChars]))
		runes = runes[maxChars:]
	}
	if len(runes) > 0 {
		lines = append(lines, string(runes))
	}
	return lines
}

func maxFloat(left, right float64) float64 {
	if left > right {
		return left
	}
	return right
}
