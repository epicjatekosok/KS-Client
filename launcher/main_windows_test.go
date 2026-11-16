//go:build windows

package main

import (
 "os"
 "path/filepath"
 "testing"
 "time"
 "os/exec"
)

func TestSwitchTokenValidation(t *testing.T){
 valid:="0123456789abcdef0123456789abcdef"
 if !validSwitchToken(valid){t.Fatal("valid nonce rejected")}
 for _,bad:=range []string{"","wrong","../../bad","0123456789abcdef0123456789abcdeg"}{
  if validSwitchToken(bad){t.Errorf("invalid nonce accepted: %q",bad)}
 }
}
func TestEnginePaths(t *testing.T){
 base:=filepath.Join("C:","KS-Client")
 e,dir:=runtimeFile(base,"electron")
 if filepath.Base(e)!="electron.exe"||filepath.Base(dir)!="Electron"{t.Fatal("invalid Electron path")}
 c,dir:=runtimeFile(base,"cef")
 if filepath.Base(c)!="KS.Cef.Client.exe"||filepath.Base(dir)!="CEF"{t.Fatal("invalid CEF path")}
}
func TestInitialEngineDefaultsToElectron(t *testing.T) {
 t.Setenv("LOCALAPPDATA",t.TempDir())
 if chosenEngine()!="electron"{t.Fatal("fresh install should use Electron")}
 if err:=os.MkdirAll(dataDir(),0700);err!=nil{t.Fatal(err)}
 if err:=os.WriteFile(prefsFile(),[]byte("unknown\n"),0600);err!=nil{t.Fatal(err)}
 if chosenEngine()!="electron"{t.Fatal("invalid preference must fall back to Electron")}
 if err:=saveEngine("cef");err!=nil{t.Fatal(err)}
 if chosenEngine()!="cef"{t.Fatal("explicitly saved CEF choice must remain")}
}
func TestReadyDoesNotChangeSelectionUntilConfirmed(t *testing.T){
 // Isolate the application preference directory and verify that failure
 // cannot overwrite the previously selected engine.
 temp:=t.TempDir()
 old:=os.Getenv("LOCALAPPDATA")
 t.Setenv("LOCALAPPDATA",temp)
 defer os.Setenv("LOCALAPPDATA",old)
 if err:=saveEngine("cef");err!=nil{t.Fatal(err)}
 token:="deadbeefdeadbeefdeadbeefdeadbeef"
 // Invalid executable must not count as a successful switch.
 cmd:=exec.Command("cmd.exe","/c","exit","3")
 if err:=cmd.Start();err!=nil{t.Fatal(err)}
 if err:=awaitEngineSwitch(cmd,"electron",token);err==nil{t.Fatal("exited child passed readiness")}
 if chosenEngine()!="cef"{t.Fatal("engine selection changed on startup failure")}
}
func TestSwitchTimeoutConstant(t *testing.T){
 if switchTimeout<30*time.Second||switchTimeout>60*time.Second{t.Fatal("invalid switch timeout")}
}
