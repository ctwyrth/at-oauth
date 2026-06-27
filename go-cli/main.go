package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strings"

	"github.com/bluesky-social/indigo/atproto/auth/oauth"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "USage: go run main.go <your-handle>")
		os.Exit(1)
	}
	handle := os.Args[1]

	if err := run(context.Background(), handle); err != nil {
		log.Fatal(err)
	}
}

func run(ctx context.Context, handle string) error {
	// Start the callback server on a random available port
	callbackCh := make(chan url.Values, 1)
	port, server, err := listenForCallback(ctx, callbackCh)
	if err != nil {
		return err
	}
	defer server.Close()

	callbackURL := fmt.Sprintf("http://127.0.0.1:%d/callback", port)

	// Create an OAuth client with localhost config and in-memory storage
	config := oauth.NewLocalhostConfig(callbackURL, []string{"atproto"})
	store := oauth.NewMemStore()
	oauthClient := oauth.NewClientApp(&config, store)

	// Start OAuth flow
	fmt.Printf("Logging in as %s...\n", handle)
	authURL, err := oauthClient.StartAuthFlow(ctx, handle)
	if err != nil {
		return fmt.Errorf("starting auth flow: %w", err)
	}

	// Open the browser to the authorization URL
	fmt.Printf("Opening browser...\n")
	if !strings.HasPrefix(authURL, "https://") {
		return fmt.Errorf("unexpected non-https auth URL")
	}
	if err := openBrowser(authURL); err != nil {
		fmt.Printf("Could notopen browser automatically.\nPlease visit: %s\n", authURL)
	}

	// Wait for OAuth callback
	fmt.Println("Waiting for authorization...")
	params := <-callbackCh

	// Exchange the authorization for a session
	sessData, err := oauthClient.ProcessCallback(ctx, params)
	if err != nil {
		return fmt.Errorf("processing callback: %w", err)
	}
	fmt.Printf("Logged in! DID: %s\n", sessData.AccountDID)

	// Resume the session to get an API client
	session, err := oauthClient.ResumeSession(ctx, sessData.AccountDID, sessData.SessionID)
	if err != nil {
		return fmt.Errorf("resuming session: %w", err)
	}

	// Fetch the user's session info to prove it works
	client := session.APIClient()
	var resp struct {
		DID			string	`json:"did"`
		Handle	string	`json:"handle"`
	}
	if err := client.Get(ctx, "com.atproto.server.getSession", nil, &resp); err != nil {
		return fmt.Errorf("fetching session: %w", err)
	}

	fmt.Printf("\nSession:\n")
	fmt.Printf("   Handle: %s\n", resp.Handle)
	fmt.Printf("   DID:    %s\n", resp.DID)
	fmt.Printf("   Host:   %s\n", sessData.HostURL)

	return nil
}

func listenForCallback(ctx context.Context, res chan url.Values) (int, *http.Server, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, nil, err
	}

	mux := http.NewServeMux()
	server := &http.Server{Handler: mux}

	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		res <- r.URL.Query()
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(200)
		w.Write([]byte("<h1>Authorized! You can close this tab.</h1>"))
		go server.Shutdown(ctx)
	})

	go func() {
		if err := server.Serve(listener); !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	} ()

	return listener.Addr().(*net.TCPAddr).Port, server, nil
}

func openBrowser(url string) error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", url).Run()
	case "windows":
		return exec.Command("cmd", "/c", "start", url).Run()
	default:
		return exec.Command("xdg-open", url).Run()
	}
}
