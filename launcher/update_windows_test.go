//go:build windows
package main

import (
 "strings"
 "testing"
)
func makeAsset(tag string)updateAsset{
 v,ok:=parseVersion(tag)
 if !ok{panic("invalid test release: "+tag)}
 name:="KS-Client-"+strings.TrimPrefix(tag,"v")+"-Setup.exe"
 if v.track=="stable"{name="KS-Client-"+strings.TrimPrefix(tag,"v")+"-Setup.exe"}
 if v.track!="stable"{
  base:=strings.TrimSuffix(strings.TrimPrefix(tag,"v"),"-"+v.track)
  name="KS-Client-"+v.track+"-"+base+"-Setup.exe"
 }
 return updateAsset{Name:name,Size:422370816,Digest:"sha256:"+strings.Repeat("a",64),
   URL:"https://github.com/"+updateRepo+"/releases/download/"+tag+"/"+name,State:"uploaded"}
}
func TestVersionComparison(t *testing.T){
 alpha,_:=parseVersion("v1.1.23-alpha")
 beta,_:=parseVersion("v1.0.0-beta")
 betaNext,_:=parseVersion("v1.0.1-beta")
 stable,_:=parseVersion("v1.0.0")
 if compareVersion(alpha,beta)>=0 {t.Fatal("alpha 1.1.23 must upgrade to beta 1.0.0")}
 if compareVersion(beta,betaNext)>=0 || compareVersion(betaNext,stable)>=0 {t.Fatal("beta and stable precedence broken")}
 for _,tag:=range []string{"v1.1.23-alpha-evil","v1.1.19-rc1","1.0.0-beta","v1.0.0-","v0.0.0-preview"}{
  if _,ok:=parseVersion(tag);ok{t.Fatalf("accepted invalid version: %s",tag)}
 }
}
func TestPublicAssetPinning(t *testing.T){
 a:=makeAsset("v1.0.1-beta")
 if !validUpdateAsset(a,"v1.0.1-beta"){t.Fatal("valid public beta asset rejected")}
 a.URL="https://example.net/bad.exe"
 if validUpdateAsset(a,"v1.0.1-beta"){t.Fatal("external asset host accepted")}
 a=makeAsset("v1.0.1-beta");a.Digest="sha256:unverified"
 if validUpdateAsset(a,"v1.0.1-beta"){t.Fatal("missing digest accepted")}
 a=makeAsset("v1.0.1-beta");a.Size=updateMaxBytes+1
 if validUpdateAsset(a,"v1.0.1-beta"){t.Fatal("oversized executable accepted")}
}
func TestUpdateChannels(t *testing.T){
 releases:=[]updateRelease{
  {Tag:"v1.1.24-alpha",Prerelease:true,Assets:[]updateAsset{makeAsset("v1.1.24-alpha")}},
  {Tag:"v1.0.30-beta",Prerelease:true,Assets:[]updateAsset{makeAsset("v1.0.30-beta")}},
  {Tag:"v1.0.0",Prerelease:false,Assets:[]updateAsset{makeAsset("v1.0.0")}},
 }
 for _,channel:=range []string{"alpha","beta","stable"}{
  choice,ok:=chooseUpdate(releases,channel)
  if !ok||choice.release.Tag!="v1.0.0"{t.Fatalf("%s channel must prefer verified stable: %+v",channel,choice)}
 }
 choice,ok:=chooseUpdate(releases[:2],"alpha")
 if !ok||choice.release.Tag!="v1.0.30-beta"{t.Fatal("alpha channel should include promoted beta")}
 choice,ok=chooseUpdate(releases[:2],"beta")
 if !ok||choice.release.Tag!="v1.0.30-beta"{t.Fatal("beta channel should prefer beta, excluding old alpha")}
 if _,ok=chooseUpdate(releases[:2],"stable");ok{t.Fatal("stable channel accepted beta/alpha")}
 if _,ok=chooseUpdate(releases[:1],"beta");ok{t.Fatal("beta channel accepted legacy alpha bridge")}
}
func TestNoCurrentVersionOffered(t *testing.T){
 current:=makeAsset("v1.0.29-beta")
 if _,ok:=chooseUpdate([]updateRelease{{Tag:"v1.0.29-beta",Prerelease:true,Assets:[]updateAsset{current}}},"beta");ok{
  t.Fatal("updater must not offer the already installed beta")
 }
}
func TestNoUnverifiedDownloads(t *testing.T){
 a:=makeAsset("v1.0.30-beta");a.State="not_uploaded"
 if _,ok:=chooseUpdate([]updateRelease{{Tag:"v1.0.30-beta",Prerelease:true,Assets:[]updateAsset{a}}},"beta");ok {t.Fatal("unverified asset offered")}
}
