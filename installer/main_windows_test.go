//go:build windows

package main

import (
 "archive/zip"
 "bytes"
 "encoding/json"
 "strings"
 "os"
 "path/filepath"
 "testing"
)

func TestOfflinePayloadIncludesBothEngines(t *testing.T) {
  if len(archive) < 1024 { t.Fatal("empty installer embed") }
  r, err := zip.NewReader(bytes.NewReader(archive),int64(len(archive)))
  if err != nil { t.Fatal(err) }
  expected:=map[string]bool{
    "KS-Client.exe":false,
    "Uninstall-KS-Client.exe":false,
    "runtime/Electron/electron.exe":false,
    "runtime/Electron/resources/app/main.cjs":false,
    "runtime/CEF/KS.Cef.Client.exe":false,
    "runtime/CEF/dotnet/dotnet.exe":false,
  }
  for _, f:=range r.File {if _,ok:=expected[f.Name];ok{expected[f.Name]=true}}
  for name,ok:=range expected {if !ok {t.Errorf("offline payload missing %s",name)}}
}

func TestExtractAndCopyOfflinePayload(t *testing.T) {
  // Uses the actual extractPayload/installFiles routines without touching the
  // Windows registry, user's existing installation or persistent browser data.
  local:=os.Getenv("LOCALAPPDATA")
  if local=="" {t.Skip("LOCALAPPDATA missing")}
  base:=filepath.Join(local,"Programs")
  if err:=os.MkdirAll(base,0700);err!=nil {t.Fatal(err)}
  dir,err:=os.MkdirTemp(base,"KS Client CI Smoke-")
  if err!=nil {t.Fatal(err)}
  defer os.RemoveAll(dir)
  stage:=t.TempDir()
  if err=extractPayload(stage);err!=nil {t.Fatal("cannot extract offline payload:",err)}
  if err=installFiles(stage,dir);err!=nil {t.Fatal("cannot install offline payload:",err)}
  for _,rel:=range []string{"KS-Client.exe","runtime/Electron/electron.exe","runtime/CEF/KS.Cef.Client.exe","runtime/CEF/dotnet/dotnet.exe"} {
    info,err:=os.Stat(filepath.Join(dir,filepath.FromSlash(rel)))
    if err!=nil || info.Size()==0 {t.Errorf("installed runtime missing: %s: %v",rel,err)}
  }
  // Exercise the in-place replacement path without needing the GUI.
  if err=installFiles(stage,dir);err!=nil {t.Fatal("in-place upgrade failed:",err)}
}


// Test the version DISPLAYED in Setup against the actual embedded ZIP.
// Include a synthetic later release to prove the UI has no hard-coded version.
func TestBundledVersionMatchesBothEngines(t *testing.T){
  got,err:=bundledVersion()
  if err!=nil{t.Fatal(err)}
  // Derive the expected version from the source package used to build the
  // verified offline archive, not a hard-coded previous release version.
  source,err:=os.ReadFile(filepath.Join("..","electron-app","package.json"))
  if err!=nil{t.Fatal(err)}
  var pkg struct{Version string `json:"version"`}
  if err:=json.Unmarshal(source,&pkg);err!=nil{t.Fatal(err)}
  if !strings.HasSuffix(pkg.Version,"-beta"){t.Fatalf("invalid source package version %q",pkg.Version)}
  expected:=strings.TrimSuffix(pkg.Version,"-beta")
  if got!=expected{t.Fatalf("built ZIP version = %q, source package version = %q",got,expected)}
}
func TestBundledVersionIsNotHardCoded(t *testing.T){
  makeBundle:=func(electron,cef string)[]byte{
    var buf bytes.Buffer
    writer:=zip.NewWriter(&buf)
    for _,pair:=range [][2]string{
      {"runtime/Electron/resources/app/package.json",`{"version":"`+electron+`"}`},
      {"runtime/CEF/ks-smoke-pass.json",`{"version":"`+cef+`"}`},
    } {
      file,err:=writer.Create(pair[0]);if err!=nil{t.Fatal(err)}
      if _,err=file.Write([]byte(pair[1]));err!=nil{t.Fatal(err)}
    }
    if err:=writer.Close();err!=nil{t.Fatal(err)}
    return buf.Bytes()
  }
  next:=makeBundle("9.8.7-beta","9.8.7")
  got,err:=bundledVersionFromArchive(next)
  if err!=nil||got!="9.8.7"{t.Fatalf("version not derived from package metadata: got %q, err %v",got,err)}
  if _,err:=bundledVersionFromArchive(makeBundle("9.8.7-beta","9.8.6"));err==nil{
    t.Fatal("mismatched Electron and CEF versions must be rejected")
  }
  if _,err:=bundledVersionFromArchive(makeBundle("invalid-version","9.8.7"));err==nil{
    t.Fatal("malformed release version must be rejected")
  }
}
