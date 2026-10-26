package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestComposerSelectionExplicitFalse(t *testing.T) {
	var config Chat
	if err := yaml.Unmarshal([]byte("allowAgentSelection: false\nallowModelSelection: false\n"), &config); err != nil {
		t.Fatal(err)
	}
	body, err := json.Marshal(config)
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]interface{}
	if err := json.Unmarshal(body, &decoded); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"allowAgentSelection", "allowModelSelection"} {
		if value, ok := decoded[key]; !ok || value != false {
			t.Fatalf("explicit false lost: %s", body)
		}
	}
}

func TestDocumentChatAppearanceSurvivesSerialization(t *testing.T) {
	var chat Chat
	if err := yaml.Unmarshal([]byte("appearance: document\ncommandCenter: true\nshowUpload: true\n"), &chat); err != nil {
		t.Fatal(err)
	}
	if chat.Appearance != "document" || !chat.CommandCenter || !chat.ShowUpload {
		t.Fatalf("lost chat appearance or behavior: %#v", chat)
	}
	data, err := json.Marshal(chat)
	if err != nil {
		t.Fatal(err)
	}
	var restored Chat
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatal(err)
	}
	if restored.Appearance != "document" {
		t.Fatalf("lost appearance after delivery: %s", data)
	}
}
