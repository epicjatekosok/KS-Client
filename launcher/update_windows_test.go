//go:build windows
package main

import (
 "strings"
 "testing"
)
func makeAsset(tag string)updateAsset{
 v:=strings.TrimSuffix(strings.TrimPrefix(tag,"v"),"-alpha")
 name:="KS-Client-alpha-"+v+"-Setup.exe"
 if !strings.HasSuffix(tag,"-alpha"){name="KS-Client-"+v+"-Setup.exe"}
 return updateAsset{Name:name,Size:422370816,Digest:"sha256:"+strings.Repeat("a",64),
   URL:"https://github.com/"+updateRepo+"/releases/download/"+tag+"/"+name,State:"uploaded"}
}
func TestVersionComparison(t *testing.T){
 a,ok:=parseVersion("v1.1.19-alpha");if !ok{t.Fatal("current version invalid")}
 b,_:=parseVersion("v1.1.21-alpha")
 c,_:=parseVersion("v1.1.21")
 if compareVersion(a,b)>=0||compareVersion(b,c)>=0||compareVersion(c,a)<=0{t.Fatal("semver ordering broken")}
 for _,invalid:=range []string{"v1.1.19-alpha-evil","v1.1.19-rc1","1.1.20","v1.1.20-"}{
  if _,ok:=parseVersion(invalid);ok{t.Fatalf("accepted invalid version %s",invalid)}
 }
}
func TestPublicAssetPinning(t *testing.T){
 a:=makeAsset("v1.1.21-alpha")
 if !validUpdateAsset(a,"v1.1.21-alpha"){t.Fatal("valid asset rejected")}
 a.URL="https://example.net/bad.exe"
 if validUpdateAsset(a,"v1.1.21-alpha"){t.Fatal("external update host accepted")}
 a=makeAsset("v1.1.21-alpha");a.Digest="sha256:unverified"
 if validUpdateAsset(a,"v1.1.21-alpha"){t.Fatal("missing digest accepted")}
 a=makeAsset("v1.1.21-alpha");a.Size=updateMaxBytes+1
 if validUpdateAsset(a,"v1.1.21-alpha"){t.Fatal("oversized executable accepted")}
}
func TestUpdateChannels(t *testing.T){
 releases:=[]updateRelease{
  {Tag:"v1.1.22-alpha",Prerelease:true,Assets:[]updateAsset{makeAsset("v1.1.22-alpha")}},
  {Tag:"v1.1.22",Prerelease:false,Assets:[]updateAsset{makeAsset("v1.1.22")}},
 }
 choice,ok:=chooseUpdate(releases,"alpha")
 if !ok||choice.release.Tag!="v1.1.22"{t.Fatalf("alpha channel should prefer latest stable %v %v",ok,choice.release.Tag)}
 choice,ok=chooseUpdate(releases[:1],"stable")
 if ok {t.Fatal("stable channel accepted alpha release")}
 choice,ok=chooseUpdate(releases[:1],"alpha")
 if !ok||choice.release.Tag!="v1.1.22-alpha"{t.Fatal("alpha channel failed")}
}
func TestNoUnverifiedDownloads(t *testing.T){
 a:=makeAsset("v1.1.22-alpha");a.State="not_uploaded"
 if _,ok:=chooseUpdate([]updateRelease{{Tag:"v1.1.22-alpha",Prerelease:true,Assets:[]updateAsset{a}}},"alpha");ok{t.Fatal("unverified asset offered")}
}
