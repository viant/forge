package markdown

import (
	"strings"
	"testing"
)

func TestNamedFencesShareLiteralCodeBoundaries(t *testing.T) {
	body := "````text\n```contract\nliteral\n```\n````\n~~~contract\n{type: object}\n~~~\nRead this."
	text, blocks, err := ExtractFences(body, "contract")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(text, "literal") || string(blocks["contract"]) != "{type: object}" {
		t.Fatal("literal or named block changed")
	}
	if _, _, err := ExtractFences("```contract\nx", "contract"); err == nil {
		t.Fatal("unterminated named fence accepted")
	}
	if _, _, err := ExtractFences("```contract\nx\n```\n```contract\ny\n```", "contract"); err == nil {
		t.Fatal("duplicate named fence accepted")
	}
}
func TestTextTransformPreservesCodeSamples(t *testing.T) {
	source := "${A} `${A}`\n~~~text\n${A}\n~~~"
	actual, err := TransformText(source, func(s string) (string, error) { return strings.ReplaceAll(s, "${A}", "value"), nil })
	if err != nil {
		t.Fatal(err)
	}
	if actual != "value `${A}`\n~~~text\n${A}\n~~~" {
		t.Fatal("literal sample transformed")
	}
}

func TestTextTransformPreservesMultilineInlineCode(t *testing.T) {
	source := "Before ${A} `sample\n${A}` after ${A}"
	actual, err := TransformText(source, func(s string) (string, error) { return strings.ReplaceAll(s, "${A}", "value"), nil })
	if err != nil {
		t.Fatal(err)
	}
	if actual != "Before value `sample\n${A}` after value" {
		t.Fatal("multiline inline code transformed")
	}
}
