//go:build windows

package main

import (
  "path/filepath"
  "testing"
)

func TestSwitchTokenValidation(t *testing.T){
  valid:="0123456789abcdef0123456789abcdef"
  if !validSwitchToken(valid){t.Fatal("valid nonce rejected")}
  for _,bad:=range []string{"","wrong","../../bad","0123456789abcdef0123456789abcdeg"} {
    if validSwitchToken(bad){t.Errorf("invalid nonce accepted: %q",bad)}
  }
}

func TestEnginePaths(t *testing.T){
  base:=filepath.Join("C:","KS-Client")
  electron,dir:=runtimeFile(base,"electron")
  if filepath.Base(electron)!="electron.exe" || filepath.Base(dir)!="Electron"{t.Fatal("invalid Electron runtime path")}
  cef,dir:=runtimeFile(base,"cef")
  if filepath.Base(cef)!="KS.Cef.Client.exe" || filepath.Base(dir)!="CEF"{t.Fatal("invalid CEF runtime path")}
}
