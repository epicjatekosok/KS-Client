//go:build windows

package main

import (
 "encoding/binary"
 "encoding/json"
 "fmt"
 "io"
 "os"
 "regexp"
 "strconv"
 "syscall"
 "time"
)

// An explicitly configured public Application ID opts into local Discord IPC.
// The browser renderer never receives pipe access or a Discord credential.
func keepPresence(pid int, engine string) {
 id:=os.Getenv("KS_DISCORD_APPLICATION_ID")
 if !regexp.MustCompile("^[0-9]{17,20}$").MatchString(id){return}
 process,err:=syscall.OpenProcess(0x00100000,false,uint32(pid))
 if err!=nil{return}
 defer syscall.CloseHandle(process)
 go func(){
  for {
   for i:=0;i<10;i++{
    pipe,err:=os.OpenFile(fmt.Sprintf(`\\.\pipe\discord-ipc-%d`,i),os.O_RDWR,0)
    if err!=nil{continue}
    _=presenceSession(pipe,id,engine,pid)
    pipe.Close()
    break
   }
   time.Sleep(15*time.Second)
  }
 }()
 // The launcher exits with the engine, closing even an unresponsive IPC pipe.
 _,_=syscall.WaitForSingleObject(process,syscall.INFINITE)
}

func sendPresencePacket(w io.Writer, op uint32, data []byte)error{
 frame:=make([]byte,8+len(data))
 binary.LittleEndian.PutUint32(frame,op)
 binary.LittleEndian.PutUint32(frame[4:],uint32(len(data)))
 copy(frame[8:],data)
 n,err:=w.Write(frame)
 if err==nil && n!=len(frame){return io.ErrShortWrite}
 return err
}

func presenceSession(pipe io.ReadWriter,id,engine string,pid int)error{
 hello,_:=json.Marshal(map[string]any{"v":1,"client_id":id})
 if err:=sendPresencePacket(pipe,0,hello);err!=nil{return err}
 sent:=false
 for {
  var header [8]byte
  if _,err:=io.ReadFull(pipe,header[:]);err!=nil{return err}
  length:=binary.LittleEndian.Uint32(header[4:])
  if length>65536{return fmt.Errorf("oversized Discord message")}
  payload:=make([]byte,length)
  if _,err:=io.ReadFull(pipe,payload);err!=nil{return err}
  switch binary.LittleEndian.Uint32(header[:]){
  case 2:return nil
  case 3:if err:=sendPresencePacket(pipe,4,payload);err!=nil{return err}
  case 1:
   var msg struct{Evt string}
   if err:=json.Unmarshal(payload,&msg);err!=nil{return err}
   if msg.Evt=="ERROR"{return fmt.Errorf("Discord rejected activity")}
   if msg.Evt!="READY"||sent{continue}
   activity:=map[string]any{"details":"Playing Kirka.io","state":"KS Client • "+engine}
   body,_:=json.Marshal(map[string]any{"cmd":"SET_ACTIVITY","nonce":strconv.Itoa(pid),"args":map[string]any{"pid":pid,"activity":activity}})
   if err:=sendPresencePacket(pipe,1,body);err!=nil{return err}
   sent=true
  }
 }
}
