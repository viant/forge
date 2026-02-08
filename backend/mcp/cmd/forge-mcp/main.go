package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	flags "github.com/jessevdk/go-flags"
	"github.com/viant/mcp-protocol/schema"
	mcpsrv "github.com/viant/mcp/server"

	forgemcp "github.com/viant/forge/backend/mcp/mcp"
	forgesvc "github.com/viant/forge/backend/mcp/service"
)

type Options struct {
	HTTPAddr        string   `short:"a" long:"addr" description:"HTTP listen address (default: 127.0.0.1:5025; set to 'disabled' to skip HTTP server)"`
	UIWSPath        string   `long:"ui-ws-path" description:"WebSocket path for Forge UI bridge (default: /forge/ui)"`
	UIRPCPath       string   `long:"ui-rpc-path" description:"HTTP JSON-RPC path for Forge UI bridge (default: /forge/ui/rpc)"`
	UIToken         string   `long:"ui-token" description:"Optional shared token; UI must send it in ui.hello.token"`
	UITokenRequired bool     `long:"ui-token-required" description:"Require ui-token and reject UI clients without a matching token (default: true)"`
	UILocalOnly     bool     `long:"ui-local-only" description:"Restrict UI WS connections to loopback/localhost (default: true)"`
	UIAllowedOrigin []string `long:"ui-allowed-origin" description:"Allowed WebSocket Origin header values (repeatable). When omitted, only localhost origins are accepted."`
	UseData         bool     `long:"use-data" description:"Return tool results in structured content instead of text field"`
}

func main() {
	opts := Options{
		HTTPAddr:        "127.0.0.1:5025",
		UIWSPath:        "/forge/ui",
		UIRPCPath:       "/forge/ui/rpc",
		UITokenRequired: true,
		UILocalOnly:     true,
	}
	if _, err := flags.NewParser(&opts, flags.Default).Parse(); err != nil {
		if ferr, ok := err.(*flags.Error); ok && ferr.Type == flags.ErrHelp {
			os.Exit(0)
		}
		log.Printf("flag parse error: %v", err)
		os.Exit(2)
	}

	if opts.UITokenRequired && opts.UIToken == "" {
		log.Printf("error: --ui-token is required when --ui-token-required=true")
		os.Exit(2)
	}

	svc := forgesvc.NewService(&forgesvc.Config{
		Token:          opts.UIToken,
		RequireToken:   opts.UITokenRequired,
		LocalOnly:      opts.UILocalOnly,
		AllowedOrigins: opts.UIAllowedOrigin,
		UseData:        opts.UseData,
	})

	server, err := mcpsrv.New(
		mcpsrv.WithImplementation(schema.Implementation{Name: "forge-mcp", Version: "0.1.0"}),
		mcpsrv.WithNewHandler(forgemcp.NewHandler(svc)),
		mcpsrv.WithEndpointAddress(opts.HTTPAddr),
		mcpsrv.WithRootRedirect(true),
		mcpsrv.WithStreamableURI("/mcp"),
		mcpsrv.WithCustomHTTPHandler(opts.UIWSPath, svc.Hub().ServeWS),
		mcpsrv.WithCustomHTTPHandler(opts.UIRPCPath, svc.Hub().ServeHTTPRPC),
	)
	if err != nil {
		log.Fatal(err)
	}

	if opts.HTTPAddr == "disabled" {
		log.Printf("forge-mcp HTTP server disabled")
		return
	}

	server.UseStreamableHTTP(true)
	srv := server.HTTP(context.Background(), opts.HTTPAddr)
	srv.ReadHeaderTimeout = 10 * time.Second
	srv.ReadTimeout = 60 * time.Second
	srv.WriteTimeout = 60 * time.Second
	srv.IdleTimeout = 120 * time.Second

	log.Printf("forge-mcp listening on %s (mcp: /mcp, ui-ws: %s, ui-rpc: %s)", srv.Addr, opts.UIWSPath, opts.UIRPCPath)

	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe() }()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	sig := <-sigCh
	log.Printf("shutdown signal received: %v", sig)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("http shutdown error: %v", err)
	}
	if err := <-errCh; err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
	log.Printf("forge-mcp stopped")
}
