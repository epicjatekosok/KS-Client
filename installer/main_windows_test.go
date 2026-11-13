//go:build windows

package main

import (
 "archive/zip"
 "bytes"
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
