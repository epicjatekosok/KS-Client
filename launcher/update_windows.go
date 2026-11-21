//go:build windows

// KS Client update manager. The trusted launcher owns the update network calls;
// the Kirka renderer only requests a check or confirms a user-initiated install.
package main

import (
 "crypto/rand"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "net/http"
 "os"
 "os/exec"
 "path/filepath"
 "regexp"
 "strconv"
 "strings"
 "syscall"
 "time"
 "ksclient/ksui"
)

const updateRepo = "epicjatekosok/KS-Client-Updates"
const updateMaxBytes int64 = 950 * 1024 * 1024
var updateTag = regexp.MustCompile("^v([0-9]+)[.]([0-9]+)[.]([0-9]+)(-alpha|-beta)?$")
var digestPattern = regexp.MustCompile("^sha256:[0-9a-f]{64}$")

type updateAsset struct {
 Name string `json:"name"`
 Size int64 `json:"size"`
 Digest string `json:"digest"`
 URL string `json:"browser_download_url"`
 State string `json:"state"`
}
type updateRelease struct {
 Tag string `json:"tag_name"`
 Name string `json:"name"`
 Body string `json:"body"`
 Draft bool `json:"draft"`
 Prerelease bool `json:"prerelease"`
 Assets []updateAsset `json:"assets"`
}
type updateChoice struct {
 release updateRelease
 asset updateAsset
 cached bool
}
type versionParts struct {major,minor,patch int; track string}
func parseVersion(s string)(versionParts,bool){
 m:=updateTag.FindStringSubmatch(s)
 if m==nil{return versionParts{},false}
 a,e:=strconv.Atoi(m[1]);if e!=nil{return versionParts{},false}
 b,e:=strconv.Atoi(m[2]);if e!=nil{return versionParts{},false}
 c,e:=strconv.Atoi(m[3]);if e!=nil{return versionParts{},false}
 track:=strings.TrimPrefix(m[4],"-")
 if track==""{track="stable"}
 return versionParts{a,b,c,track},true
}
func trackPriority(track string)int{
 switch track{
 case "alpha":return 0
 case "beta":return 1
 case "stable":return 2
 }
 return -1
}
// Alpha 1.1.23 -> Beta 1.0.0 is a product-track promotion,
// intentionally NOT numerical semver ordering. Within one track the
// version numbers use conventional major/minor/patch ordering.
func compareVersion(a,b versionParts)int{
 if x,y:=trackPriority(a.track),trackPriority(b.track);x!=y {
  if x>y{return 1};return -1
 }
 for i,v:=range []int{a.major,a.minor,a.patch}{
  w:=[]int{b.major,b.minor,b.patch}[i]
  if v>w{return 1};if v<w{return -1}
 }
 return 0
}
func updateChannel(channel string)string {
 switch channel{
 case "alpha","beta","stable":return channel
 default:return "beta"
 }
}
func validUpdateAsset(asset updateAsset, tag string)bool{
 parsed,ok:=parseVersion(tag)
 if !ok{return false}
 full:=fmt.Sprintf("%d.%d.%d",parsed.major,parsed.minor,parsed.patch)
 expected:="KS-Client-"+full+"-Setup.exe"
 if parsed.track!="stable"{expected="KS-Client-"+parsed.track+"-"+full+"-Setup.exe"}
 if asset.Name!=expected||asset.State!="uploaded"||asset.Size<1000000||asset.Size>updateMaxBytes{return false}
 if !digestPattern.MatchString(strings.ToLower(asset.Digest)){return false}
 expectedURL:="https://github.com/"+updateRepo+"/releases/download/"+tag+"/"+expected
 return asset.URL==expectedURL
}
func chooseUpdate(releases []updateRelease,channel string)(updateChoice,bool){
 tag:="v"+version
 if releaseTrack!="stable"{tag+="-"+releaseTrack}
 current,_:=parseVersion(tag)
 var best updateChoice
 var bestVer versionParts
 found:=false
 for _,release:=range releases{
  v,ok:=parseVersion(release.Tag)
  if !ok||release.Draft||release.Prerelease!=(v.track!="stable"){continue}
  if channel=="stable"&&v.track!="stable"{continue}
  if channel=="beta"&&v.track=="alpha"{continue}
  if compareVersion(v,current)<=0{continue}
  for _,asset:=range release.Assets{
   if !validUpdateAsset(asset,release.Tag){continue}
   if !found||compareVersion(v,bestVer)>0 {
    best=updateChoice{release:release,asset:asset};bestVer=v;found=true
   }
  }
 }
 return best,found
}
// Keep a bounded HTTP timeout, but do not let the UI's subprocess deadline
// kill a still-working GitHub lookup. A normal update check makes at most
// two short requests and never downloads release binaries.
func updateHTTP() *http.Client{
 return &http.Client{
  Timeout:18*time.Second,
  CheckRedirect:func(req *http.Request,via []*http.Request)error{
   if len(via)>8||req.URL.Scheme!="https"{return errors.New("insecure release redirect")}
   host:=strings.ToLower(req.URL.Hostname())
   if host!="github.com"&&host!="api.github.com"&&host!="objects.githubusercontent.com"&&
     host!="release-assets.githubusercontent.com"&&!strings.HasSuffix(host,".githubusercontent.com"){
    return errors.New("update redirect outside trusted GitHub hosts")
   }
   return nil
  },
 }
}
func releaseFeed(client *http.Client)([]updateRelease,error){
 // This lists enough recent releases for all supported channels without
 // fetching the large historical feed. GitHub API responses are untrusted:
 // chooseUpdate/validUpdateAsset still enforce exact names, digests and URLs.
 endpoint:="https://api.github.com/repos/"+updateRepo+"/releases?per_page=20"
 request,e:=http.NewRequest("GET",endpoint,nil);if e!=nil{return nil,e}
 request.Header.Set("Accept","application/vnd.github+json")
 request.Header.Set("User-Agent","KS-Client-Updater/"+releaseTrack+"-"+version)
 request.Header.Set("X-GitHub-Api-Version","2022-11-28")
 response,e:=client.Do(request);if e!=nil{return nil,e}
 defer response.Body.Close()
 if response.StatusCode!=200{
  if response.StatusCode==404{return nil,errors.New("The public KS-Client-Updates release feed was not found; open the Releases page to check manually.")}
  if response.StatusCode==403||response.StatusCode==429{return nil,errors.New("GitHub limited update checks; use Open GitHub Releases or try again later.")}
  return nil,fmt.Errorf("GitHub update lookup HTTP %d; use Open GitHub Releases if needed",response.StatusCode)
 }
 var releases []updateRelease
 if e=json.NewDecoder(io.LimitReader(response.Body,3*1024*1024)).Decode(&releases);e!=nil{return nil,e}
 return releases,nil
}
func getUpdates()(updateChoice,bool,error){
 client:=updateHTTP()
 releases,err:=releaseFeed(client)
 if err!=nil{
  // Retry only transient network errors, not 403/404 or a malformed feed.
  // The entire retry is limited to less than the Electron caller's timeout.
  var networkError interface{Timeout()bool}
  if errors.As(err,&networkError)||errors.Is(err,io.EOF) {
   time.Sleep(350*time.Millisecond)
   releases,err=releaseFeed(client)
  }
 }
 if err!=nil{
  var networkError interface{Timeout()bool}
  if errors.As(err,&networkError) {
   return updateChoice{},false,errors.New("GitHub did not respond in time. Check your internet connection or use Open GitHub Releases. You can retry without restarting KS Client.")
  }
  return updateChoice{},false,err
 }
 choice,found:=chooseUpdate(releases,updateChannel(updateMode))
 return choice,found,nil
}
// updateMode is set from the launcher argument, never directly from web content.
var updateMode="beta"
func updateCachePath(choice updateChoice)string{
 dir:=filepath.Join(dataDir(),"Updates","cache",choice.release.Tag)
 return filepath.Join(dir,choice.asset.Name)
}
func shaFile(p string)(string,error){
 f,e:=os.Open(p);if e!=nil{return "",e};defer f.Close()
 h:=sha256.New();if _,e=io.Copy(h,f);e!=nil{return "",e}
 return hex.EncodeToString(h.Sum(nil)),nil
}
func validCached(choice updateChoice)bool{
 p:=updateCachePath(choice)
 info,e:=os.Stat(p);if e!=nil||info.Size()!=choice.asset.Size{return false}
 sum,e:=shaFile(p)
 return e==nil&&strings.EqualFold(sum,strings.TrimPrefix(choice.asset.Digest,"sha256:"))
}
func downloadUpdate(choice updateChoice,progress func(int64,int64)) (string,error){
 dest:=updateCachePath(choice)
 if validCached(choice){if progress!=nil{progress(choice.asset.Size,choice.asset.Size)};return dest,nil}
 if e:=os.MkdirAll(filepath.Dir(dest),0700);e!=nil{return "",e}
 client:=updateHTTP();client.Timeout=30*time.Minute
 request,e:=http.NewRequest("GET",choice.asset.URL,nil);if e!=nil{return "",e}
 request.Header.Set("User-Agent","KS-Client-Updater/"+releaseTrack+"-"+version)
 response,e:=client.Do(request);if e!=nil{return "",e};defer response.Body.Close()
 if response.StatusCode!=200{return "",fmt.Errorf("update download HTTP %d",response.StatusCode)}
 if response.ContentLength>updateMaxBytes{return "",errors.New("update exceeds download size limit")}
 temp:=dest+".part"
 os.Remove(temp)
 out,e:=os.OpenFile(temp,os.O_CREATE|os.O_EXCL|os.O_WRONLY,0600);if e!=nil{return "",e}
 success:=false
 defer func(){out.Close();if !success{os.Remove(temp)}}()
 h:=sha256.New()
 total:=int64(0)
 buf:=make([]byte,256*1024)
 for {
  n,err:=response.Body.Read(buf)
  if n>0{
   total+=int64(n)
   if total>updateMaxBytes{return "",errors.New("update exceeds download limit")}
   if _,e=out.Write(buf[:n]);e!=nil{return "",e}
   h.Write(buf[:n])
   if progress!=nil{progress(total,choice.asset.Size)}
  }
  if err==io.EOF{break}
  if err!=nil{return "",err}
 }
 if total!=choice.asset.Size{return "",fmt.Errorf("downloaded size mismatch: got %d expected %d",total,choice.asset.Size)}
 if !strings.EqualFold(hex.EncodeToString(h.Sum(nil)),strings.TrimPrefix(choice.asset.Digest,"sha256:")){return "",errors.New("update SHA256 integrity verification failed")}
 if e=out.Sync();e!=nil{return "",e}
 if e=out.Close();e!=nil{return "",e}
 magic,e:=os.Open(temp);if e!=nil{return "",e}
 first:=make([]byte,2);_,e=io.ReadFull(magic,first);magic.Close()
 if e!=nil||string(first)!="MZ"{return "",errors.New("downloaded installer is not a Windows executable")}
 os.Remove(dest)
 if e=os.Rename(temp,dest);e!=nil{return "",e}
 success=true
 return dest,nil
}
func statusJSON(value map[string]interface{}){
 value["current"]=version
 value["channel"]=updateMode
 value["source"]=updateRepo
 encoder:=json.NewEncoder(os.Stdout)
 _=encoder.Encode(value)
}
func checkUpdateCLI(){
 choice,found,e:=getUpdates()
 if e!=nil {statusJSON(map[string]interface{}{"state":"unavailable","message":e.Error()});return}
 if !found{statusJSON(map[string]interface{}{"state":"current","message":"No newer verified release on the selected channel."});return}
 statusJSON(map[string]interface{}{
  "state":"available","version":strings.TrimPrefix(choice.release.Tag,"v"),
  "notes":choice.release.Body,"bytes":choice.asset.Size,"cached":validCached(choice),
  "message":"A newer KS Client release is available.",
 })
}
func randomID()string{b:=make([]byte,12);if _,e:=rand.Read(b);e!=nil{return strconv.FormatInt(time.Now().UnixNano(),16)};return hex.EncodeToString(b)}
func copyUpdaterWorker(source,dest string)error{
 in,e:=os.Open(source);if e!=nil{return e};defer in.Close()
 if e=os.MkdirAll(filepath.Dir(dest),0700);e!=nil{return e}
 out,e:=os.OpenFile(dest,os.O_CREATE|os.O_EXCL|os.O_WRONLY,0700);if e!=nil{return e}
 _,err:=io.Copy(out,in);c:=out.Close();if err!=nil{os.Remove(dest);return err}
 if c!=nil{os.Remove(dest);return c}
 return nil
}
func startUpdateWorker(mode string,channel string)error{
 own,e:=os.Executable();if e!=nil{return e}
 target:=filepath.Dir(own)
 if _,e=os.Stat(filepath.Join(target,"runtime","Electron","electron.exe"));e!=nil{return errors.New("Update requires full KS Client folder")}
 worker:=filepath.Join(dataDir(),"Updates","worker-"+randomID()+".exe")
 if e=copyUpdaterWorker(own,worker);e!=nil{return e}
 arguments:=[]string{"--ks-update-worker","--mode="+mode,"--channel="+channel,"--target="+target,"--wait-pid="+strconv.Itoa(os.Getppid())}
 cmd:=exec.Command(worker,arguments...)
 cmd.Dir=filepath.Dir(worker)
 if e=cmd.Start();e!=nil{os.Remove(worker);return e}
 return cmd.Process.Release()
}
func waitForExitedPID(pid int)error{
 if pid<=0{return nil}
 handle,e:=syscall.OpenProcess(0x00100000,false,uint32(pid))
 if e!=nil{return nil} // already exited
 defer syscall.CloseHandle(handle)
 status,e:=syscall.WaitForSingleObject(handle,120000)
 if e!=nil{return e}
 if status!=syscall.WAIT_OBJECT_0{return errors.New("Close KS Client before installing the update.")}
 return nil
}
func updateWorkerCLI(mode,target string,waitPID int){
 target=filepath.Clean(target)
 if !filepath.IsAbs(target)||filepath.VolumeName(target)==target||target=="."{
  return
 }
 if _,e:=os.Stat(filepath.Join(target,"KS-Client.exe"));e!=nil{return}
 choice,found,e:=getUpdates()
 if e!=nil{showUpdateError(e);return}
 if !found{showUpdateError(errors.New("No newer release available."));return}
 if mode=="prefetch"{
  _,e=downloadUpdate(choice,nil)
  if e!=nil{appendLog("Update prefetch: "+e.Error())}
  return
 }
 w:=ksui.New("KS Client - Update "+choice.release.Tag,"Downloading KS Client update","Verified GitHub release · both engines · saved settings kept")
 w.Version="Beta "+version
 w.SetButtons(ksui.Button{Label:"Close",ID:"close",Enabled:false})
 w.OnButton=func(id string){if id=="close"{w.Close()}}
 go func(){
  w.Update("DOWNLOADING","Getting verified standalone installer…",.01)
  lastUpdate:=time.Now().Add(-time.Second)
  setup,err:=downloadUpdate(choice,func(n,total int64){
   if time.Since(lastUpdate)<250*time.Millisecond&&n<total{return}
   lastUpdate=time.Now()
   w.Update("DOWNLOADING",fmt.Sprintf("%.0f / %.0f MB",float64(n)/1048576,float64(total)/1048576),float64(n)/float64(total)*.85)
  })
  if err==nil{
   w.Update("PREPARING","Waiting for KS Client to close before installing…",.88)
   err=waitForExitedPID(waitPID)
  }
  if err==nil{
   w.Update("VERIFIED","Opening the offline installer. Your profiles remain on disk.",.95)
   cmd:=exec.Command(setup,"--ks-update-target="+target)
   cmd.Dir=filepath.Dir(setup)
   err=cmd.Start()
   if err==nil {cmd.Process.Release();w.Close();return}
  }
  w.AddLog("Update failed: "+err.Error())
  appendLog("Update failed: "+err.Error())
  w.Update("UPDATE FAILED",err.Error(),0)
  w.SetButtons(ksui.Button{Label:"Close",ID:"close",Enabled:true})
 }()
 _=w.Run()
}
func showUpdateError(e error){
 appendLog("Update service error: "+e.Error())
 w:=ksui.New("KS Client - Update error","Could not update KS Client","The current installation has not been changed.")
 w.Version="Beta "+version
 w.AddLog(e.Error())
 w.Update("NO CHANGE",e.Error(),0)
 w.SetButtons(ksui.Button{Label:"Close",ID:"close",Enabled:true})
 w.OnButton=func(id string){if id=="close"{w.Close()}}
 _=w.Run()
}
// handleUpdateCLI intercepts update commands before the normal engine launcher.
// There is no token embedded in the client and no URL accepted from game JS.
func handleUpdateCLI(args []string)bool{
 mode:="";channel:="beta";target:="";waitPID:=0;worker:=false
 for _,arg:=range args{
  switch{
  case arg=="--ks-update-check":mode="check"
  case arg=="--ks-update-self-test":mode="self-test"
  case arg=="--ks-update-install":mode="install"
  case arg=="--ks-update-prefetch":mode="prefetch"
  case arg=="--ks-update-worker":worker=true
  case strings.HasPrefix(arg,"--mode="):if worker{mode=strings.TrimPrefix(arg,"--mode=")}
  case strings.HasPrefix(arg,"--channel="):channel=strings.TrimPrefix(arg,"--channel=")
  case strings.HasPrefix(arg,"--target="):target=strings.TrimPrefix(arg,"--target=")
  case strings.HasPrefix(arg,"--wait-pid="):waitPID,_=strconv.Atoi(strings.TrimPrefix(arg,"--wait-pid="))
  }
 }
 if mode==""&&!worker{return false}
 updateMode=updateChannel(channel)
 if worker {
  if mode=="install"||mode=="prefetch"{updateWorkerCLI(mode,target,waitPID)}
  return true
 }
 if mode=="check"{checkUpdateCLI();return true}
 if mode=="self-test"{statusJSON(map[string]interface{}{"state":"ready","message":"Launcher update CLI ready; no network used."});return true}
 if mode!="install"&&mode!="prefetch"{return true}
 if e:=startUpdateWorker(mode,updateMode);e!=nil{
  statusJSON(map[string]interface{}{"state":"error","message":e.Error()})
 }else{statusJSON(map[string]interface{}{"state":"started","message":"Updater started."})}
 return true
}
