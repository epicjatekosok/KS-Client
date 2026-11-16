//go:build windows

// KS Client alpha 1.1.16: engine-neutral Windows launcher.
// A switch is committed only after the newly started native host acknowledges
// its own readiness. A transient game page/network failure is not engine failure.
package main

import (
 "encoding/hex"
 "crypto/rand"
 "errors"
 "fmt"
 "ksclient/ksui"
 "os"
 "os/exec"
 "path/filepath"
 "strings"
 "time"
)

const version = "1.1.16"
const switchTimeout = 45 * time.Second

func message(title, body string, _ uintptr) { ksui.Alert(title, body) }
func dataDir() string {
 local := os.Getenv("LOCALAPPDATA")
 if local == "" { return "" }
 return filepath.Join(local, "KSClient")
}
func prefsFile() string { return filepath.Join(dataDir(), "selected-engine.txt") }
func chosenEngine() string {
 b,err:=os.ReadFile(prefsFile())
 if err==nil && strings.TrimSpace(strings.ToLower(string(b)))=="electron" {return "electron"}
 return "cef"
}
func saveEngine(engine string) error {
 folder:=dataDir()
 if folder=="" {return errors.New("LOCALAPPDATA is missing")}
 if err:=os.MkdirAll(folder,0700);err!=nil{return err}
 return os.WriteFile(prefsFile(),[]byte(engine+"\n"),0600)
}
func runtimeFile(base,engine string)(string,string){
 if engine=="electron"{
  dir:=filepath.Join(base,"runtime","Electron")
  return filepath.Join(dir,"electron.exe"),dir
 }
 dir:=filepath.Join(base,"runtime","CEF")
 return filepath.Join(dir,"KS.Cef.Client.exe"),dir
}
func validSwitchToken(token string)bool{
 if len(token)!=32 {return false}
 _,err:=hex.DecodeString(token)
 return err==nil
}
func switchPath(token,suffix string)string{
 return filepath.Join(dataDir(),"engine-switch-"+token+suffix)
}
func reportSwitchFailure(token,detail string){
 if !validSwitchToken(token)||dataDir()==""{return}
 _=os.MkdirAll(dataDir(),0700)
 _=os.WriteFile(switchPath(token,".error"),[]byte(detail),0600)
}
func appendLog(line string){
 if dataDir()==""{return}
 _=os.MkdirAll(dataDir(),0700)
 file,e:=os.OpenFile(filepath.Join(dataDir(),"launcher-"+version+".log"),os.O_CREATE|os.O_WRONLY|os.O_APPEND,0600)
 if e!=nil{return}
 defer file.Close()
 _,_=fmt.Fprintf(file,"%s %s\n",time.Now().UTC().Format(time.RFC3339),line)
}
// The launcher, not either browser, owns the saved engine selection.
// Browser hosts can only create a ".ready" signal; the launcher validates the
// target engine, commits the preference and publishes ".ok" to the old host.
func awaitEngineSwitch(cmd *exec.Cmd,engine,token string)error{
 ready:=switchPath(token,".ready")
 ok:=switchPath(token,".ok")
 previous:=chosenEngine()
 exited:=make(chan error,1)
 go func(){exited<-cmd.Wait()}()
 timer:=time.NewTimer(switchTimeout)
 ticker:=time.NewTicker(200*time.Millisecond)
 defer timer.Stop()
 defer ticker.Stop()
 for{
  select{
  case err:=<-exited:
   if err==nil{return fmt.Errorf("%s exited without reporting native readiness",engine)}
   return fmt.Errorf("%s exited before readiness: %w",engine,err)
  case <-timer.C:
   _=cmd.Process.Kill()
   return fmt.Errorf("%s did not report native readiness within %s; old engine remains active",engine,switchTimeout)
  case <-ticker.C:
   data,err:=os.ReadFile(ready)
   if err!=nil {continue}
   if strings.TrimSpace(string(data))!=engine{
    _=cmd.Process.Kill()
    return fmt.Errorf("incorrect native ready signal for %s",engine)
   }
   if err:=saveEngine(engine);err!=nil{
    _=cmd.Process.Kill()
    return fmt.Errorf("could not save engine selection: %w",err)
   }
   if err:=os.WriteFile(ok,[]byte(engine),0600);err!=nil{
    _=saveEngine(previous)
    _=cmd.Process.Kill()
    return fmt.Errorf("could not confirm new engine: %w",err)
   }
   _=os.Remove(ready)
   appendLog("Switched to "+engine+" after native startup confirmation")
   return nil
  }
 }
}
func main(){
 own,err:=os.Executable()
 if err!=nil{message("KS Client - Launch Error",err.Error(),0);return}
 base:=filepath.Dir(own)
 engine:=chosenEngine()
 token:=""
 explicitEngine:=false
 safe,probe:=false,false
 args:=os.Args[1:]
 for i:=0;i<len(args);i++{
  switch{
  case args[i]=="--engine"&&i+1<len(args):
   if args[i+1]=="cef"||args[i+1]=="electron"{engine=args[i+1];explicitEngine=true}
   i++
  case strings.HasPrefix(args[i],"--engine="):
   v:=strings.TrimPrefix(args[i],"--engine=")
   if v=="cef"||v=="electron"{engine=v;explicitEngine=true}
  case strings.HasPrefix(args[i],"--ks-switch-token="):
   v:=strings.TrimPrefix(args[i],"--ks-switch-token=")
   if validSwitchToken(v){token=v}
  case args[i]=="--ks-switch-probe":
   probe=true
  case args[i]=="--ks-browser-safe-mode":
   safe=true
  case args[i]=="--repair-engines":
   message("KS Client - Repair","Please rerun the complete offline installer; both engines are shipped together.",0);return
  }
 }
 if token=="" && explicitEngine {
  // Even a direct '--engine electron' request must confirm a real native
  // window before making it the permanent selected engine.
  b:=make([]byte,16)
  if _,err:=rand.Read(b);err!=nil{message("KS Client - Randomness Error",err.Error(),0);return}
  token=hex.EncodeToString(b)
 }
 file,dir:=runtimeFile(base,engine)
 if st,err:=os.Stat(file);err!=nil||st.IsDir(){
  detail:="Target "+engine+" executable missing: "+file
  appendLog(detail)
  reportSwitchFailure(token,detail)
  if token==""{message("KS Client - Engine Missing",detail+"\nReinstall the full offline KS Client package.",0)}
  return
 }
 pass:=[]string{}
 if safe{pass=append(pass,"--ks-browser-safe-mode")}
 if token!=""{pass=append(pass,"--ks-switch-token="+token)}
 if probe&&token!=""{pass=append(pass,"--ks-switch-probe")}
 if token!=""{
  if err:=os.MkdirAll(dataDir(),0700);err!=nil{reportSwitchFailure(token,err.Error());return}
  for _,ext:=range []string{".ready",".ok",".error"}{_ =os.Remove(switchPath(token,ext))}
 }
 cmd:=exec.Command(file,pass...)
 cmd.Dir=dir
 if engine=="cef"{
  localDotnet:=filepath.Join(dir,"dotnet")
  if _,err:=os.Stat(filepath.Join(localDotnet,"host","fxr"));err==nil{
   cmd.Env=append(os.Environ(),"DOTNET_ROOT="+localDotnet,"DOTNET_ROOT_X64="+localDotnet,"DOTNET_MULTILEVEL_LOOKUP=0")
  }
 }
 appendLog("Starting "+engine+" executable "+file)
 if err:=cmd.Start();err!=nil{
  detail:="Failed to start "+engine+": "+err.Error()
  appendLog(detail)
  reportSwitchFailure(token,detail)
  if token==""{message("KS Client - Launch Error",detail,0)}
  return
 }
 if token!=""{
  if err:=awaitEngineSwitch(cmd,engine,token);err!=nil{
   appendLog("Switch failure: "+err.Error())
   reportSwitchFailure(token,err.Error())
   if explicitEngine && !probe {
    message("KS Client - Engine Launch Error",err.Error()+"\nCheck %LOCALAPPDATA%\\KSClient\\launcher-1.1.16.log",0)
   }
  }
  return
 }
 _=cmd.Process.Release()
 if err:=saveEngine(engine);err!=nil{message("KS Client - Preference Warning",err.Error(),0)}
}
