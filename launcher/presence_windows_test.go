package main

import (
 "bytes"
 "encoding/binary"
 "encoding/json"
 "io"
 "testing"
)

type rpcFixture struct{io.Reader;io.Writer}

func TestPresenceLocalProtocol(t *testing.T){
 var server,client bytes.Buffer
 for _,message:=range []struct{op uint32; body string}{{1,`{"evt":"READY"}`},{3,"ping"},{2,""}}{
  if err:=sendPresencePacket(&server,message.op,[]byte(message.body));err!=nil{t.Fatal(err)}
 }
 if err:=presenceSession(rpcFixture{&server,&client},"123456789012345678","cef",77);err!=nil{t.Fatal(err)}
 for _,op:=range []uint32{0,1,4}{
  header:=client.Next(8)
  if len(header)!=8 || binary.LittleEndian.Uint32(header)!=op{t.Fatal("wrong opcode")}
  body:=client.Next(int(binary.LittleEndian.Uint32(header[4:])))
  if op==4 {if string(body)!="ping"{t.Fatal("ping payload")};continue}
  var data struct{ClientID string `json:"client_id"`;Cmd string;Args struct{Pid int}}
  if err:=json.Unmarshal(body,&data);err!=nil{t.Fatal(err)}
  if op==0 && data.ClientID!="123456789012345678"{t.Fatal("client ID mismatch")}
  if op==1 && (data.Cmd!="SET_ACTIVITY"||data.Args.Pid!=77){t.Fatal("wrong activity")}
 }
}
