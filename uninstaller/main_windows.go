//go:build windows

// KS Client alpha 1.1.6 English per-user uninstaller.
// English button captions are drawn by our own Win32 dialog, independent of OS language.
package main

import (
	"fmt"
	"ksclient/ksui"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

const uninstallKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\KSClientTwoEngine`

var uninstallProgress func(string, string, float64)

func status(stage, detail string, progress float64) {
	if uninstallProgress != nil {
		uninstallProgress(stage, detail, progress)
	}
}

const oldUninstallKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\KSClient`

func message(title, body string, _ uintptr) uintptr { ksui.Alert(title, body); return 1 }
func isExpectedFolder(dir string) bool {
	local := os.Getenv("LOCALAPPDATA")
	if local == "" {
		return false
	}
	folder := filepath.Clean(dir)
	root := filepath.Join(local, "Programs")
	// Limit deletions to an app-specific installation directory under Programs.
	rel, err := filepath.Rel(root, folder)
	if err != nil || rel == "." || rel == ".." || filepath.IsAbs(rel) || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return false
	}
	allowed := []string{filepath.Join(root, "KS Client Electron CEF"), filepath.Join(root, "KS Client alpha 1.1.0"), filepath.Join(root, "KS Client")}
	if registered, err := readRegistryString("KSClientTwoEngine", "InstallLocation"); err == nil {
		allowed = append(allowed, registered)
	}
	for _, name := range allowed {
		if strings.EqualFold(filepath.Clean(name), folder) {
			if info, err := os.Lstat(folder); err == nil && info.Mode()&os.ModeSymlink != 0 {
				return false
			}
			return true
		}
	}
	return false
}
func removeShortcuts() {
	var folders []string
	if appdata := os.Getenv("APPDATA"); appdata != "" {
		folders = append(folders, filepath.Join(appdata, "Microsoft", "Windows", "Start Menu", "Programs"))
	}
	if home := os.Getenv("USERPROFILE"); home != "" {
		folders = append(folders, filepath.Join(home, "Desktop"))
	}
	for _, dir := range folders {
		for _, name := range []string{"KS Client.lnk", "KS Client alpha 1.1.0.lnk", "KS Client alpha 1.1.1.lnk", "KS Client alpha 1.1.2.lnk", "KS Client alpha 1.1.3.lnk", "KS Client alpha 1.1.4.lnk", "KS Client alpha 1.1.6.lnk"} {
			_ = os.Remove(filepath.Join(dir, name))
		}
	}
}
func deleteRegistryKey(key string) error {
	cmd := exec.Command("reg.exe", "delete", key, "/f")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	if err != nil {
		// If the key is absent, nothing needs to be removed.
		if !strings.Contains(strings.ToLower(string(output)), "unable to find") && !strings.Contains(strings.ToLower(string(output)), "not found") {
			return fmt.Errorf("could not remove Installed apps entry: %w", err)
		}
	}
	return nil
}
func removeRegistry(folder string) error {
	registered, err := readRegistryString("KSClientTwoEngine", "InstallLocation")
	if err == nil && strings.EqualFold(filepath.Clean(registered), filepath.Clean(folder)) {
		if err := deleteRegistryKey(uninstallKey); err != nil {
			return err
		}
	}
	old, err := readRegistryString("KSClient", "InstallLocation")
	if err == nil && strings.EqualFold(filepath.Clean(old), filepath.Clean(folder)) {
		if err := deleteRegistryKey(oldUninstallKey); err != nil {
			return err
		}
	}
	return nil
}
func removeProgramFiles(folder string) error {
	if !isExpectedFolder(folder) {
		return fmt.Errorf("refusing unexpected installation path %q", folder)
	}
	entries, err := os.ReadDir(folder)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	for i, entry := range entries {
		status("REMOVING PROGRAM FILES", entry.Name(), .04+.83*float64(i)/float64(max(1, len(entries))))
		file := filepath.Join(folder, entry.Name())
		if err := os.RemoveAll(file); err != nil {
			return fmt.Errorf("could not remove %s: %w. Close KS Client, Electron and CEF before uninstalling", entry.Name(), err)
		}
	}
	status("REMOVING PROGRAM FILES", "Finishing the application directory…", .88)
	return os.Remove(folder)
}
func cleanup(folder string, deleteData bool) error {
	if err := removeProgramFiles(folder); err != nil {
		return err
	}
	status("CLEANUP", "Removing shortcuts and Windows Installed Apps registration…", .9)
	removeShortcuts()
	if err := removeRegistry(folder); err != nil {
		return err
	}
	if !deleteData {
		status("COMPLETE", "Your settings and browser profiles were preserved.", 1)
		return nil
	}
	local := os.Getenv("LOCALAPPDATA")
	if local == "" {
		return fmt.Errorf("program removed but browser profiles could not be located")
	}
	data := filepath.Join(local, "KSClient")
	status("REMOVING PERSONAL DATA", "Deleting saved browser profiles…", -1)
	for _, name := range []string{"ElectronProfile", "CefProfile"} {
		if err := os.RemoveAll(filepath.Join(data, name)); err != nil {
			return err
		}
	}
	for _, name := range []string{
		"browser-settings.json", "selected-engine.txt",
		"electron-1.1.0.log", "electron-1.1.1.log", "electron-1.1.2.log", "electron-1.1.3.log", "electron-1.1.4.log", "electron-1.1.6.log",
		"cef-1.1.0.log", "cef-1.1.1.log", "cef-1.1.2.log", "cef-1.1.3.log", "cef-1.1.4.log", "cef-1.1.6.log",
		"engine-install-1.1.3.log", "engine-install-1.1.4.log", "engine-install-1.1.6.log", "setup-1.1.3.log", "setup-1.1.4.log", "setup-1.1.6.log",
	} {
		if err := os.Remove(filepath.Join(data, name)); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	_ = os.Remove(data)
	status("COMPLETE", "The application and selected personal data were removed.", 1)
	return nil
}
func main() {
	if len(os.Args) >= 4 && os.Args[1] == "--cleanup" {
		folder := os.Args[2]
		if !isExpectedFolder(folder) {
			message("KS Client Uninstaller - Error", "Invalid installation directory.", 0)
			os.Exit(1)
		}
		deleteData := os.Args[3] == "--delete-data"
		w := ksui.New("KS Client • Uninstall 1.1.6", "Removing KS Client", "Application files and browser runtimes · protected cleanup")
		w.SetButtons(ksui.Button{Label: "Close", ID: "close", Enabled: false})
		w.OnButton = func(id string) {
			if id == "close" {
				w.Close()
			}
		}
		uninstallProgress = func(stage, detail string, pct float64) { w.Update(stage, detail, pct) }
		go func() {
			w.Update("PREPARING", "Checking the application installation…", .01)
			if err := cleanup(folder, deleteData); err != nil {
				w.AddLog(err.Error())
				w.Update("UNINSTALL FAILED", err.Error(), 0)
			} else {
				w.AddLog("Removal completed successfully.")
				w.Update("COMPLETE", "KS Client files were removed.", 1)
			}
			w.SetButtons(ksui.Button{Label: "Close", ID: "close", Enabled: true})
		}()
		_ = w.Run()
		return
	}
	self, err := os.Executable()
	if err != nil {
		message("KS Client Uninstaller - Error", err.Error(), 0x10)
		os.Exit(1)
	}
	dir := filepath.Dir(self)
	if !isExpectedFolder(dir) {
		message("KS Client Uninstaller - Error", "Run this uninstaller from the KS Client installation directory.", 0x10)
		os.Exit(1)
	}
	if askEnglish("KS Client Uninstaller - alpha 1.1.6",
		"Remove KS Client from this Windows account?\n\n"+
			"Application files, Electron and CEF runtime files, and shortcuts will be removed.\n"+
			"You can choose whether to keep your saved settings and browser profiles.\n\n"+
			"Close every KS Client, Electron, and CEF window before continuing.",
		dialogButton{"Yes", 6}, dialogButton{"No", 7}) != 6 {
		return
	}
	response := askEnglish("KS Client Uninstaller - Personal Data",
		"Permanently delete KS Client settings and browser profiles as well?\n\n"+
			"Yes - Delete saved settings and both browser profiles.\n"+
			"No - Keep saved settings and browser profiles (recommended).\n"+
			"Cancel - Stop uninstalling.\n\n"+
			"Important: profile deletion may affect earlier KS Client installations.",
		dialogButton{"Yes", 6}, dialogButton{"No", 7}, dialogButton{"Cancel", 2})
	if response != 6 && response != 7 {
		return
	}
	tmp, err := os.CreateTemp(os.TempDir(), "ks-client-uninstaller-*.exe")
	if err != nil {
		message("KS Client Uninstaller - Error", err.Error(), 0x10)
		os.Exit(1)
	}
	tempPath := tmp.Name()
	_ = tmp.Close()
	bytes, err := os.ReadFile(self)
	if err != nil {
		message("KS Client Uninstaller - Error", err.Error(), 0x10)
		os.Exit(1)
	}
	if err := os.WriteFile(tempPath, bytes, 0700); err != nil {
		message("KS Client Uninstaller - Error", err.Error(), 0x10)
		os.Exit(1)
	}
	mode := "--keep-data"
	if response == 6 {
		mode = "--delete-data"
	}
	cmd := exec.Command(tempPath, "--cleanup", dir, mode)
	if err := cmd.Start(); err != nil {
		message("KS Client Uninstaller - Error", err.Error(), 0x10)
		os.Exit(1)
	}
	_ = cmd.Process.Release()
}
