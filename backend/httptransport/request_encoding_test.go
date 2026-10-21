package httptransport

import (
	"bytes"
	"compress/gzip"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func compressed(t *testing.T, payload []byte) []byte {
	t.Helper()
	var b bytes.Buffer
	writer := gzip.NewWriter(&b)
	if _, err := writer.Write(payload); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}
func TestRequestEncodingExactUTF8AndLegacy(t *testing.T) {
	payload := []byte(`{"method":"ui.snapshot","params":{"data":{"form":{"name":"日本語 café 👋"},"selection":{"id":7},"collection":[{"id":7}],"dirty":true}}}`)
	for _, encoding := range []string{"", "identity", "gzip"} {
		t.Run(encoding, func(t *testing.T) {
			called := false
			handler := DecodeRequestEncoding(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				body, err := io.ReadAll(r.Body)
				if err != nil || !bytes.Equal(body, payload) {
					t.Fatal("lossy request decode")
				}
				if r.Header.Get("Mcp-Session-Id") != "session" || r.Header.Get("Authorization") != "Bearer retained" {
					t.Fatal("transport auth headers changed")
				}
				if encoding == "gzip" && r.Header.Get("Content-Encoding") != "" {
					t.Fatal("downstream still encoded")
				}
				w.WriteHeader(204)
			}))
			body := payload
			if encoding == "gzip" {
				body = compressed(t, payload)
			}
			r := httptest.NewRequest("POST", "/ui", bytes.NewReader(body))
			r.Header.Set("Content-Encoding", encoding)
			r.Header.Set("Mcp-Session-Id", "session")
			r.Header.Set("Authorization", "Bearer retained")
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)
			if !called || w.Code != 204 {
				t.Fatal("request not delegated")
			}
		})
	}
}
func TestRequestEncodingRejectsBeforeDispatch(t *testing.T) {
	valid := compressed(t, []byte(strings.Repeat("x", 256)))
	for _, scenario := range []struct {
		name, encoding    string
		body              []byte
		encoded, inflated int64
		status            int
	}{{"malformed", "gzip", []byte("invalid"), 100, 100, 400}, {"truncated", "gzip", valid[:len(valid)-4], 100, 1000, 400}, {"encoded-limit", "gzip", valid, 8, 1000, 413}, {"inflated-limit", "gzip", valid, 100, 128, 413}, {"unsupported", "br", valid, 100, 1000, 415}, {"stacked", "gzip, gzip", valid, 100, 1000, 415}, {"unknown-length-limit", "gzip", valid, 8, 1000, 413}} {
		t.Run(scenario.name, func(t *testing.T) {
			called := false
			handler := DecodeRequestEncodingWithLimits(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { called = true }), scenario.encoded, scenario.inflated)
			r := httptest.NewRequest("POST", "/ui", bytes.NewReader(scenario.body))
			r.Header.Set("Content-Encoding", scenario.encoding)
			if scenario.name == "unknown-length-limit" {
				r.ContentLength = -1
			}
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)
			if called || w.Code != scenario.status {
				t.Fatalf("dispatch=%v code=%d", called, w.Code)
			}
		})
	}
}
func TestRequestEncodingCancelledDoesNotDispatch(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	r := httptest.NewRequest("POST", "/ui", bytes.NewReader(compressed(t, []byte(`{}`)))).WithContext(ctx)
	r.Header.Set("Content-Encoding", "gzip")
	called := false
	w := httptest.NewRecorder()
	DecodeRequestEncoding(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { called = true })).ServeHTTP(w, r)
	if called || w.Code != 400 {
		t.Fatal("cancelled body dispatched")
	}
}
