// Package httptransport contains bounded, lossless HTTP transport adapters.
package httptransport

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"strings"
)

const MaxCompressedRequestBytes int64 = 8 << 20
const MaxInflatedRequestBytes int64 = 32 << 20

// DecodeRequestEncoding leaves legacy plain requests and downstream limits
// untouched. Authentication remains the embedding host's outer middleware.
// Encoded and inflated gzip bytes are bounded independently before dispatch.
func DecodeRequestEncoding(next http.Handler) http.Handler {
	return DecodeRequestEncodingWithLimits(next, MaxCompressedRequestBytes, MaxInflatedRequestBytes)
}
func DecodeRequestEncodingWithLimits(next http.Handler, compressed, inflated int64) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		encoding := strings.ToLower(strings.TrimSpace(r.Header.Get("Content-Encoding")))
		if encoding == "" || encoding == "identity" {
			next.ServeHTTP(w, r)
			return
		}
		if encoding != "gzip" {
			http.Error(w, "unsupported request encoding", http.StatusUnsupportedMediaType)
			return
		}
		if compressed <= 0 || inflated <= 0 {
			http.Error(w, "request encoding unavailable", http.StatusUnsupportedMediaType)
			return
		}
		if r.ContentLength > compressed {
			http.Error(w, "encoded request too large", http.StatusRequestEntityTooLarge)
			return
		}
		encoded, err := io.ReadAll(io.LimitReader(r.Body, compressed+1))
		if err != nil {
			http.Error(w, "invalid encoded request", http.StatusBadRequest)
			return
		}
		if int64(len(encoded)) > compressed {
			http.Error(w, "encoded request too large", http.StatusRequestEntityTooLarge)
			return
		}
		reader, err := gzip.NewReader(bytes.NewReader(encoded))
		if err != nil {
			http.Error(w, "invalid encoded request", http.StatusBadRequest)
			return
		}
		decoded, err := io.ReadAll(io.LimitReader(reader, inflated+1))
		closeErr := reader.Close()
		if int64(len(decoded)) > inflated {
			http.Error(w, "inflated request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if err != nil || closeErr != nil || r.Context().Err() != nil {
			http.Error(w, "invalid encoded request", http.StatusBadRequest)
			return
		}
		request := r.Clone(r.Context())
		request.Body = io.NopCloser(bytes.NewReader(decoded))
		request.ContentLength = int64(len(decoded))
		request.Header.Del("Content-Encoding")
		request.Header.Del("Content-Length")
		next.ServeHTTP(w, request)
	})
}
