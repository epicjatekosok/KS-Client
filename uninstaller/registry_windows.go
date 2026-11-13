//go:build windows

package main

import (
	"fmt"
	"strings"
	"syscall"
	"unsafe"
)

const regBase = `Software\Microsoft\Windows\CurrentVersion\Uninstall\`
const regCurrentUser = uintptr(0x80000001)
const regKeyRead = 0x20019
const regString = 1

var regAdvapi = syscall.NewLazyDLL("advapi32.dll")
var regOpen = regAdvapi.NewProc("RegOpenKeyExW")
var regQuery = regAdvapi.NewProc("RegQueryValueExW")
var regClose = regAdvapi.NewProc("RegCloseKey")

func readRegistryString(keyName, valueName string) (string, error) {
	var key uintptr
	full := regBase + keyName
	status, _, _ := regOpen.Call(regCurrentUser, uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(full))),
		0, regKeyRead, uintptr(unsafe.Pointer(&key)))
	if status != 0 {
		return "", fmt.Errorf("registry key unavailable: %d", status)
	}
	defer regClose.Call(key)
	var size uint32
	var kind uint32
	status, _, _ = regQuery.Call(key, uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(valueName))),
		0, uintptr(unsafe.Pointer(&kind)), 0, uintptr(unsafe.Pointer(&size)))
	if status != 0 || kind != regString || size < 2 || size > 65536 {
		return "", fmt.Errorf("registry value unavailable or invalid")
	}
	buf := make([]uint16, (size+1)/2+1)
	status, _, _ = regQuery.Call(key, uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(valueName))),
		0, uintptr(unsafe.Pointer(&kind)), uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&size)))
	if status != 0 || kind != regString {
		return "", fmt.Errorf("registry read failed: %d", status)
	}
	result := strings.TrimSpace(syscall.UTF16ToString(buf))
	if result == "" {
		return "", fmt.Errorf("empty registry path")
	}
	return result, nil
}
