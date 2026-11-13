//go:build windows

// KS Client alpha 1.1.6: engine-neutral launcher. CEF is the default engine.
// The preference is shared between Electron and CEF, and only real installed
// runtimes may be launched. No WebView2 dependency.
package main

import (
	"fmt"
	"ksclient/ksui"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func message(title, body string, _ uintptr) { ksui.Alert(title, body) }
func dataDir() string {
	local := os.Getenv("LOCALAPPDATA")
	if local == "" {
		return ""
	}
	return filepath.Join(local, "KSClient")
}
func prefsFile() string { return filepath.Join(dataDir(), "selected-engine.txt") }
func chosenEngine() string {
	if b, err := os.ReadFile(prefsFile()); err == nil && strings.TrimSpace(strings.ToLower(string(b))) == "electron" {
		return "electron"
	}
	return "cef"
}
func saveEngine(engine string) error {
	folder := dataDir()
	if folder == "" {
		return fmt.Errorf("LOCALAPPDATA is missing")
	}
	if err := os.MkdirAll(folder, 0700); err != nil {
		return err
	}
	return os.WriteFile(prefsFile(), []byte(engine+"\n"), 0600)
}
func runtimeFile(base, engine string) (string, string) {
	if engine == "electron" {
		dir := filepath.Join(base, "runtime", "Electron")
		return filepath.Join(dir, "electron.exe"), dir
	}
	dir := filepath.Join(base, "runtime", "CEF")
	return filepath.Join(dir, "KS.Cef.Client.exe"), dir
}

func main() {
	own, err := os.Executable()
	if err != nil {
		message("KS Client - Launch Error", err.Error(), 0x10)
		return
	}
	base := filepath.Dir(own)
	engine := chosenEngine()
	args := os.Args[1:]
	safe := false
	for i := 0; i < len(args); i++ {
		switch {
		case args[i] == "--engine" && i+1 < len(args):
			if args[i+1] == "cef" || args[i+1] == "electron" {
				engine = args[i+1]
			}
			i++
		case strings.HasPrefix(args[i], "--engine="):
			value := strings.TrimPrefix(args[i], "--engine=")
			if value == "cef" || value == "electron" {
				engine = value
			}
		case args[i] == "--repair-engines":
			message("KS Client - Repair", "Please run the complete OFFLINE KS Client setup package. Both engines are prebuilt and included.", 0x10)
			return
		case args[i] == "--ks-browser-safe-mode":
			safe = true
		}
	}
	file, dir := runtimeFile(base, engine)
	if st, err := os.Stat(file); err != nil || st.IsDir() {
		message("KS Client - Engine Missing", "The "+strings.ToUpper(engine)+" engine is missing from the installation.\n\nReinstall using the complete, Windows-tested OFFLINE setup package.", 0x10)
		return
	}
	pass := []string{}
	if safe {
		pass = append(pass, "--ks-browser-safe-mode")
	}
	cmd := exec.Command(file, pass...)
	cmd.Dir = dir
	// The CEF host is framework-dependent. Bundle the supported .NET Windows Desktop
	// runtime beside it instead of asking end users to install an SDK.
	if engine == "cef" {
		localDotnet := filepath.Join(dir, "dotnet")
		if _, err := os.Stat(filepath.Join(localDotnet, "host", "fxr")); err == nil {
			cmd.Env = append(os.Environ(), "DOTNET_ROOT="+localDotnet, "DOTNET_ROOT_X64="+localDotnet, "DOTNET_MULTILEVEL_LOOKUP=0")
		}
	}
	if err := cmd.Start(); err != nil {
		message("KS Client - Launch Error", fmt.Sprintf("Cannot start %s:\n%v", engine, err), 0x10)
		return
	}
	_ = cmd.Process.Release()
	if err := saveEngine(engine); err != nil {
		message("KS Client - Preference Warning", err.Error(), 0x30)
	}
}
