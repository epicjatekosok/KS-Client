//go:build windows

// KS Client installer: the displayed version comes from the embedded release payload.
// Upgrades registered installations in-place, preserves user profiles,
// and uses English-labelled native UI buttons regardless of Windows locale.
package main

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"encoding/json"
	"regexp"
	"fmt"
	"io"
	"ksclient/ksui"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

var installationVersion string // supplied by the embedded tested installer payload
const uninstallKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\KSClientTwoEngine`
const oldUninstallKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\KSClient`

//go:embed KS-Client-beta-1.0.23-Portable.zip
var archive []byte

// Read the version actually present in the embedded, smoke-tested offline
// package. Electron package and smoke marker must agree before setup touches an installation.
var betaPackageVersion=regexp.MustCompile("^[0-9]+[.][0-9]+[.][0-9]+-beta$")
func bundledVersionFromArchive(payload []byte)(string,error){
    reader,err:=zip.NewReader(bytes.NewReader(payload),int64(len(payload)))
    if err!=nil{return "",fmt.Errorf("unreadable offline package: %w",err)}
    var packageVersion,markerVersion string
    for _,file:=range reader.File{
        if file.Name!="runtime/Electron/resources/app/package.json" &&
           file.Name!="runtime/Electron/ks-smoke-pass.json"{continue}
        source,err:=file.Open()
        if err!=nil{return "",err}
        blob,readErr:=io.ReadAll(io.LimitReader(source,4096))
        closeErr:=source.Close()
        if readErr!=nil{return "",readErr}
        if closeErr!=nil{return "",closeErr}
        var metadata struct{Version string `json:"version"`}
        if err=json.Unmarshal(blob,&metadata);err!=nil{return "",fmt.Errorf("invalid embedded version metadata: %w",err)}
        if file.Name=="runtime/Electron/resources/app/package.json"{packageVersion=metadata.Version
        }else{markerVersion=metadata.Version}
    }
    if !betaPackageVersion.MatchString(packageVersion){return "",fmt.Errorf("invalid embedded Electron release version")}
    numeric:=strings.TrimSuffix(packageVersion,"-beta")
    if markerVersion!=numeric{return "",fmt.Errorf("Electron smoke marker version mismatch inside installer")}
    return numeric,nil
}
func bundledVersion()(string,error){return bundledVersionFromArchive(archive)}

var progressSink func(string, string, float64)

func report(stage, status string, pct float64) {
	if progressSink != nil {
		progressSink(stage, status, pct)
	}
}
func message(title, body string, _ uintptr) uintptr { ksui.Alert(title, body); return 1 }

func localPrograms() (string, error) {
	local := os.Getenv("LOCALAPPDATA")
	if local == "" {
		return "", fmt.Errorf("LOCALAPPDATA is unavailable")
	}
	return filepath.Join(local, "Programs"), nil
}
func safeProgramDir(folder string) bool {
 if updateTargetDir!="" && filepath.Clean(folder)==updateTargetDir && safeUpdateTarget(folder){return true}
	base, err := localPrograms()
	if err != nil || folder == "" {
		return false
	}
	rel, err := filepath.Rel(base, filepath.Clean(folder))
	if err != nil || rel == "." || filepath.IsAbs(rel) || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return false
	}
	// Avoid an attacker-controlled junction/symlink masquerading as the target folder.
	if info, err := os.Lstat(folder); err == nil && info.Mode()&os.ModeSymlink != 0 {
		return false
	}
	return true
}
func hasInstalledExe(folder string) bool {
	info, err := os.Stat(filepath.Join(folder, "KS-Client.exe"))
	return err == nil && !info.IsDir()
}

// Explicit update target is accepted only when it contains a complete existing
// KS Client installation. It allows updating portable ZIP folders in place.
var updateTargetDir string

func safeUpdateTarget(folder string) bool {
 if folder==""||!filepath.IsAbs(folder) {return false}
 cleaned:=filepath.Clean(folder)
 if strings.HasPrefix(cleaned,`\\\\`) || cleaned==filepath.VolumeName(cleaned)+string(filepath.Separator) {return false}
 if info,err:=os.Lstat(cleaned);err!=nil||!info.IsDir()||info.Mode()&os.ModeSymlink!=0{return false}
 for _,name:=range []string{"KS-Client.exe","runtime/Electron/electron.exe"} {
  stat,err:=os.Lstat(filepath.Join(cleaned,filepath.FromSlash(name)))
  if err!=nil||!stat.Mode().IsRegular(){return false}
 }
 return true
}
func isPortableUpdate(folder string)bool {
 if updateTargetDir=="" {return false}
 _,err:=os.Stat(filepath.Join(folder,".ks-installed"))
 return os.IsNotExist(err)
}

type installSelection struct {
	folder        string
	existing      bool
	legacyWebView bool
}

func selectInstallDir() (installSelection, error) {
 if updateTargetDir!="" {
  if !safeUpdateTarget(updateTargetDir){return installSelection{},fmt.Errorf("invalid existing KS Client update folder")}
  return installSelection{folder:updateTargetDir,existing:true},nil
 }
	programs, err := localPrograms()
	if err != nil {
		return installSelection{}, err
	}
	registered, err := readRegistryString("KSClientTwoEngine", "InstallLocation")
	if err == nil && safeProgramDir(registered) && hasInstalledExe(registered) {
		return installSelection{registered, true, false}, nil
	}
	stable := filepath.Join(programs, "KS Client Electron CEF")
	if hasInstalledExe(stable) {
		return installSelection{stable, true, false}, nil
	}
	twoEngineLegacy := filepath.Join(programs, "KS Client alpha 1.1.0")
	if hasInstalledExe(twoEngineLegacy) {
		return installSelection{twoEngineLegacy, true, false}, nil
	}
	// Earlier WebView2 editions used a distinct registration and install folder.
	// If no new-engine installation exists, upgrade that existing client in place.
	old, err := readRegistryString("KSClient", "InstallLocation")
	if err == nil && safeProgramDir(old) && hasInstalledExe(old) {
		return installSelection{old, true, true}, nil
	}
	oldPath := filepath.Join(programs, "KS Client")
	if hasInstalledExe(oldPath) {
		return installSelection{oldPath, true, true}, nil
	}
	return installSelection{oldPath, false, false}, nil
}

// extractPayload unpacks the complete archive into a fresh staging directory.
// The existing installation is untouched until the full archive is verified.
func extractPayload(staging string) error {
	r, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		return err
	}
	seen := map[string]bool{}
	for i, e := range r.File {
		report("VERIFYING & EXTRACTING", e.Name, 0.04+0.24*float64(i)/float64(max(1, len(r.File))))
		if strings.ContainsAny(e.Name, "\\:") || strings.HasPrefix(e.Name, "/") {
			return fmt.Errorf("invalid package path: %q", e.Name)
		}
		name := path.Clean(e.Name)
		if name == "." || name == ".." || strings.HasPrefix(name, "../") {
			return fmt.Errorf("unsafe package path: %q", e.Name)
		}
		key := strings.ToLower(name)
		if seen[key] {
			return fmt.Errorf("duplicate package entry: %q", e.Name)
		}
		seen[key] = true
		if e.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("symlink in package: %q", e.Name)
		}
		dest := filepath.Join(staging, filepath.FromSlash(name))
		if e.FileInfo().IsDir() {
			if err := os.MkdirAll(dest, 0755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
			return err
		}
		in, err := e.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(dest, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
		if err != nil {
			_ = in.Close()
			return err
		}
		_, copyErr := io.Copy(out, in)
		closeErr := out.Close()
		_ = in.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
	}
	for _, exe := range []string{"KS-Client.exe", "Uninstall-KS-Client.exe", "runtime/Electron/electron.exe", "runtime/Electron/resources/app/main.cjs"} {
		if _, err := os.Stat(filepath.Join(staging, exe)); err != nil {
			return fmt.Errorf("package is missing %s", exe)
		}
	}
	return nil
}

type appliedFile struct {
	target, backup string
	hadOld         bool
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	_, err = io.Copy(out, in)
	closeErr := out.Close()
	if err != nil {
		return err
	}
	return closeErr
}
func rollback(files []appliedFile) error {
	var failures []string
	for i := len(files) - 1; i >= 0; i-- {
		f := files[i]
		if err := os.Remove(f.target); err != nil && !os.IsNotExist(err) {
			failures = append(failures, err.Error())
		}
		if f.hadOld {
			if err := os.Rename(f.backup, f.target); err != nil {
				failures = append(failures, err.Error())
			}
		}
	}
	if len(failures) > 0 {
		return fmt.Errorf("rollback failed: %s", strings.Join(failures, "; "))
	}
	return nil
}

// installFiles is transaction-like: stage all files, then replace individually
// with rollback upon failure. Crucially it NEVER overwrites runtime/ or profiles.
func installFiles(staging, folder string) error {
	if !safeProgramDir(folder) {
		return fmt.Errorf("untrusted installation directory: %s", folder)
	}
	if err := os.MkdirAll(folder, 0755); err != nil {
		return err
	}
	var staged []string
	err := filepath.Walk(staging, func(file string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			staged = append(staged, file)
		}
		return nil
	})
	if err != nil {
		return err
	}
	token := fmt.Sprintf("%d", time.Now().UnixNano())
	applied := make([]appliedFile, 0, len(staged))
	fail := func(original error) error {
		if e := rollback(applied); e != nil {
			return fmt.Errorf("%w; %v", original, e)
		}
		return original
	}
	for index, file := range staged {
		report("INSTALLING FILES", filepath.Base(file), 0.30+0.52*float64(index)/float64(max(1, len(staged))))
		rel, err := filepath.Rel(staging, file)
		if err != nil {
			return fail(err)
		}
		target := filepath.Join(folder, rel)
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return fail(err)
		}
		// Atomic same-directory rename, after writing a complete replacement.
		suffix := fmt.Sprintf(".ksnew-%s-%d", token, index)
		pending := target + suffix
		if err := copyFile(file, pending); err != nil {
			_ = os.Remove(pending)
			return fail(fmt.Errorf("could not prepare %s: %w", rel, err))
		}
		rec := appliedFile{target: target}
		if _, err := os.Stat(target); err == nil {
			rec.hadOld = true
			rec.backup = target + fmt.Sprintf(".ksold-%s-%d", token, index)
			if err := os.Rename(target, rec.backup); err != nil {
				_ = os.Remove(pending)
				return fail(fmt.Errorf("could not replace %s (close KS Client and try again): %w", rel, err))
			}
		} else if !os.IsNotExist(err) {
			_ = os.Remove(pending)
			return fail(err)
		}
		if err := os.Rename(pending, target); err != nil {
			_ = os.Remove(pending)
			if rec.hadOld {
				_ = os.Rename(rec.backup, target)
			}
			return fail(fmt.Errorf("could not finish replacing %s: %w", rel, err))
		}
		applied = append(applied, rec)
	}
	// Retire only KS's bundled runtime. Profiles live under LOCALAPPDATA/KSClient.
    runtimeDir := filepath.Join(folder, "runtime")
    legacy := filepath.Join(runtimeDir, "CEF")
    if info, statErr := os.Lstat(legacy); statErr == nil {
        parent, parentErr := os.Lstat(runtimeDir)
        if parentErr != nil || !parent.Mode().IsDir() || parent.Mode()&os.ModeSymlink != 0 ||
            !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
            return fail(fmt.Errorf("unexpected legacy runtime path"))
        }
        if file, err := os.Lstat(filepath.Join(legacy, "KS.Cef.Client.exe")); err == nil && file.Mode().IsRegular() {
            retired := legacy+".ksold-"+token
            if err := os.Rename(legacy, retired); err != nil { return fail(err) }
            if err := os.RemoveAll(retired); err != nil { writeLog("Retired runtime cleanup: "+err.Error()) }
        }
    } else if !os.IsNotExist(statErr) { return fail(statErr) }
    for _, rec := range applied {
		if rec.hadOld {
			_ = os.Remove(rec.backup)
		}
	}
	return nil
}

// A readable command line for the Windows shell shortcut operation is less
// likely to resemble an obfuscated script than -EncodedCommand. All paths are
// passed through psQuote(); no downloaded or user-provided script is executed.
func psShortcut(source string) error {
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", source)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Run()
}
func psQuote(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }
func shortcut(target, link string) error {
	code := fmt.Sprintf("$ErrorActionPreference='Stop'; $w=New-Object -ComObject WScript.Shell; $x=$w.CreateShortcut(%s); $x.TargetPath=%s; $x.WorkingDirectory=%s; $x.IconLocation=%s; $x.Save()",
		psQuote(link), psQuote(target), psQuote(filepath.Dir(target)), psQuote(target+",0"))
	return psShortcut(code)
}
func regAdd(name, value string) error {
	cmd := exec.Command("reg.exe", "add", uninstallKey, "/v", name, "/t", "REG_SZ", "/d", value, "/f")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("registry value %s: %w (%s)", name, err, strings.TrimSpace(string(out)))
	}
	return nil
}
func registerInstall(folder string) error {
	exe := filepath.Join(folder, "KS-Client.exe")
	uninstall := filepath.Join(folder, "Uninstall-KS-Client.exe")
	fields := [][2]string{
		{"DisplayName", "KS Client"}, {"DisplayVersion", installationVersion},
		{"Publisher", "KS Client"}, {"InstallLocation", folder}, {"DisplayIcon", exe + ",0"},
		{"UninstallString", "\"" + uninstall + "\""},
	}
	for _, f := range fields {
		if err := regAdd(f[0], f[1]); err != nil {
			return err
		}
	}
	for _, v := range []string{"NoModify", "NoRepair"} {
		cmd := exec.Command("reg.exe", "add", uninstallKey, "/v", v, "/t", "REG_DWORD", "/d", "1", "/f")
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("registry flag %s: %w (%s)", v, err, string(out))
		}
	}
	return nil
}
func removeLegacyRegistration(folder string) {
	old, err := readRegistryString("KSClient", "InstallLocation")
	if err != nil || !strings.EqualFold(filepath.Clean(old), filepath.Clean(folder)) {
		return
	}
	cmd := exec.Command("reg.exe", "delete", oldUninstallKey, "/f")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Run()
	_ = os.Remove(filepath.Join(folder, "uninstall.exe")) // historical WebView2 uninstaller
}
func writeLog(s string) {
	local := os.Getenv("LOCALAPPDATA")
	if local == "" {
		return
	}
	folder := filepath.Join(local, "KSClient")
	_ = os.MkdirAll(folder, 0700)
	f, err := os.OpenFile(filepath.Join(folder, "setup-"+installationVersion+".log"), os.O_WRONLY|os.O_APPEND|os.O_CREATE, 0600)
	if err != nil {
		return
	}
	defer f.Close()
	_, _ = fmt.Fprintf(f, "%s %s\r\n", time.Now().Format(time.RFC3339), s)
}
func removeOldShortcuts() {
	var directories []string
	if home := os.Getenv("USERPROFILE"); home != "" {
		directories = append(directories, filepath.Join(home, "Desktop"))
	}
	if roaming := os.Getenv("APPDATA"); roaming != "" {
		directories = append(directories, filepath.Join(roaming, "Microsoft", "Windows", "Start Menu", "Programs"))
	}
	for _, d := range directories {
		for _, name := range []string{"KS Client alpha 1.1.0.lnk", "KS Client alpha 1.1.1.lnk", "KS Client alpha 1.1.2.lnk", "KS Client alpha 1.1.3.lnk", "KS Client alpha 1.1.4.lnk", "KS Client alpha 1.1.5.lnk", "KS Client alpha 1.1.12.lnk", "KS Client alpha 1.1.13.lnk", "KS Client alpha 1.1.14.lnk", "KS Client alpha 1.1.15.lnk", "KS Client alpha 1.1.16.lnk", "KS Client alpha 1.1.19.lnk", "KS Client alpha 1.1.20.lnk", "KS Client alpha 1.1.21.lnk", "KS Client alpha 1.1.22.lnk", "KS Client alpha 1.1.23.lnk", "KS Client Beta 1.0.3.lnk"} {
			_ = os.Remove(filepath.Join(d, name))
		}
	}
}
func makeShortcuts(folder string) string {
	exe := filepath.Join(folder, "KS-Client.exe")
	removeOldShortcuts()
	var warnings []string
	if home := os.Getenv("USERPROFILE"); home != "" {
		if err := shortcut(exe, filepath.Join(home, "Desktop", "KS Client.lnk")); err != nil {
			warnings = append(warnings, "Desktop shortcut could not be created")
		}
	}
	if roaming := os.Getenv("APPDATA"); roaming != "" {
		dest := filepath.Join(roaming, "Microsoft", "Windows", "Start Menu", "Programs", "KS Client.lnk")
		if err := shortcut(exe, dest); err != nil {
			warnings = append(warnings, "Start Menu shortcut could not be created")
		}
	}
	return strings.Join(warnings, "\n")
}
func main() {
  // Never show a misleading version or modify files for a mismatched payload.
  var versionError error
  installationVersion,versionError=bundledVersion()
  if versionError!=nil{message("KS Client Setup - Error","Cannot verify the installer version: "+versionError.Error(),0);return}
  releaseLabel:="Beta "+installationVersion
 for _,arg:=range os.Args[1:] {
  if strings.HasPrefix(arg,"--ks-update-target=") {
   candidate:=strings.TrimPrefix(arg,"--ks-update-target=")
   if !safeUpdateTarget(candidate) {message("KS Client Update - Error","Update path does not contain a safe, complete KS Client installation.",0);return}
   updateTargetDir=filepath.Clean(candidate)
  }
 }
 selected, err := selectInstallDir()
	if err != nil {
		writeLog("Detection failed: " + err.Error())
		message("KS Client Setup - Error", err.Error(), 0)
		return
	}
	folder := selected.folder
	description := "Install KS Client "+releaseLabel+" to:\n" + folder + "\n\n"
	if selected.existing {
		description = "Existing KS Client installation detected.\n\nUpgrade in place to "+releaseLabel+":\n" + folder + "\n\n"
		if selected.legacyWebView {
			description += "The old WebView2 host will be replaced.\n\n"
		}
	}
	description += "Existing browser profiles and settings will be preserved.\n\nThe Electron browser runtime is included. No build tools or download are needed during setup.\n\nProceed?"
	if askEnglish("KS Client Setup - "+releaseLabel, description, dialogButton{"Yes", 6}, dialogButton{"No", 7}) != 6 {
		return
	}
	w := ksui.New("KS Client • Setup "+installationVersion, "Installing KS Client", "Dark / Amber · Electron included")
  w.Version=releaseLabel
	w.SetButtons(ksui.Button{Label: "Close", ID: "close", Enabled: false})
	w.OnButton = func(id string) {
		if id == "close" {
			w.Close()
		} else if id == "launch" {
			cmd := exec.Command(filepath.Join(folder, "KS-Client.exe"))
			cmd.Dir = folder
			if err := cmd.Start(); err == nil {
				_ = cmd.Process.Release()
				w.Close()
			} else {
				w.AddLog("Launch failed: " + err.Error())
			}
		}
	}
	progressSink = func(stage, status string, pct float64) { w.Update(stage, status, pct) }
	go func() {
		writeLog("Starting install to: " + folder)
		w.Update("PREPARING", "Checking the installation package…", .02)
		staging, err := os.MkdirTemp("", "ks-client-stage-114-")
		if err != nil {
			w.AddLog(err.Error())
			w.Update("INSTALLATION FAILED", err.Error(), 0)
			w.SetButtons(ksui.Button{Label: "Close", ID: "close", Enabled: true})
			return
		}
		defer os.RemoveAll(staging)
		if err = extractPayload(staging); err != nil {
			writeLog("Package extraction failed: " + err.Error())
			w.AddLog(err.Error())
			w.Update("PACKAGE ERROR", "Could not verify the installation package.", 0)
			w.SetButtons(ksui.Button{Label: "Close", ID: "close", Enabled: true})
			return
		}
		// Existing runtimes/profiles remain untouched. installFiles rolls back on failure.
		for attempt := 0; attempt < 2; attempt++ {
			err = installFiles(staging, folder)
			if err == nil {
				break
			}
			writeLog("Install attempt failed: " + err.Error())
			w.AddLog("File replacement failed: " + err.Error())
			if attempt == 0 {
				w.Update("RETRYING FILE REPLACEMENT", "Close KS Client windows if they are running…", .3)
				time.Sleep(1500 * time.Millisecond)
			}
		}
		if err != nil {
			w.Update("INSTALLATION FAILED", "Could not replace locked files. Close KS Client and run Setup again.", 0)
			w.SetButtons(ksui.Button{Label: "Close", ID: "close", Enabled: true})
			return
		}
		w.Update("REGISTERING", "Finalizing installed client…", .84)
        if isPortableUpdate(folder) {
          w.AddLog("Portable folder updated in place; no Windows registration or shortcuts created.")
          writeLog("Portable update completed to: "+folder)
        } else {
		if err := registerInstall(folder); err != nil {
			writeLog("Registration warning: " + err.Error())
			w.AddLog("Installed Apps registration warning: " + err.Error())
		} else {
			removeLegacyRegistration(folder)
		}
		if warning := makeShortcuts(folder); warning != "" {
			w.AddLog(warning)
		}
		  if err:=os.WriteFile(filepath.Join(folder,".ks-installed"),[]byte("KS Client installed by Setup\\n"),0600);err!=nil{
            w.AddLog("Could not save installation marker: "+err.Error())
          }
        }
		writeLog("Installed files to: " + folder)
		w.AddLog("Application files installed successfully.")
		// All browser engines are part of the VERIFIED offline payload. Never
		// compile or download third-party code during an end-user install.
		for _, obsolete := range []string{"KS-Engine-Setup.exe", "Install-Engines.ps1", "Install-Engines.cmd"} {
			_ = os.Remove(filepath.Join(folder, obsolete))
		}
		w.Update("INSTALLATION COMPLETE", "Electron was installed from the verified offline package.", 1)
		w.AddLog("The prebuilt Electron runtime was included in this installer.")
		w.SetButtons(ksui.Button{Label: "Close", ID: "close", Enabled: true}, ksui.Button{Label: "Launch KS Client", ID: "launch", Enabled: true})
	}()
	_ = w.Run()
}
