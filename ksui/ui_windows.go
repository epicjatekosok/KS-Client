//go:build windows

// Package ksui provides a DPI-aware, non-selectable, dark KS Client setup UI.
// All content is GDI painted. No EDIT control, console, or select/copy interaction.
package ksui

import (
	"fmt"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"unsafe"
)

type Button struct {
	Label, ID string
	Enabled   bool
}
type Window struct {
	mu                                            sync.Mutex
	Hwnd                                          uintptr
	Title, Heading, Subtitle, Body, Stage, Status, Role string
	Progress                                      float64 // 0..1, or -1 for indeterminate
	Log                                           []string
	Buttons                                       []Button
	ShowProgress, ShowLog                         bool
	OnButton                                      func(string)
	closed                                        bool
	buttonRects                                   []rect
	chosen                                        string
	tick                                          int
	dirty                                         bool
}
type point struct{ X, Y int32 }
type rect struct{ Left, Top, Right, Bottom int32 }
type wndClass struct {
	Size, Style                                               uint32
	Proc                                                      uintptr
	CExtra, WExtra                                            int32
	Instance, Icon, Cursor, Background, Menu, Name, SmallIcon uintptr
}
type msg struct {
	Hwnd, Message, Wparam, Lparam uintptr
	Time                          uint32
	Pt                            point
	Private                       uint32
}
type paintStruct struct {
	HDC                uintptr
	Erase              int32
	RcPaint            rect
	Restore, IncUpdate int32
	Reserved           [32]byte
}

const (
	wmPaint            = 0xF
	wmEraseBkgnd       = 0x14
	wmClose            = 0x10
	wmDestroy          = 2
	wmSize             = 5
	wmTimer            = 0x113
	wmMouseMove        = 0x200
	wmLButtonDown      = 0x201
	wmLButtonUp        = 0x202
	wmApp              = 0x8001
	wmDpiChanged       = 0x02E0
	wsOverlappedWindow = 0x00CF0000
	wsVisible          = 0x10000000
	wsClipChildren     = 0x02000000
	dtLeft             = 0
	dtCenter           = 1
	dtVCenter          = 4
	dtWordBreak        = 0x10
	dtSingleLine       = 0x20
	dtNoPrefix         = 0x800
	transparent        = 1
	psSolid            = 0
	srccopy            = 0x00CC0020
)

var (
	usr                    = syscall.NewLazyDLL("user32.dll")
	gdi                    = syscall.NewLazyDLL("gdi32.dll")
	kern                   = syscall.NewLazyDLL("kernel32.dll")
	register               = usr.NewProc("RegisterClassExW")
	create                 = usr.NewProc("CreateWindowExW")
	defProc                = usr.NewProc("DefWindowProcW")
	getMessage             = usr.NewProc("GetMessageW")
	translate              = usr.NewProc("TranslateMessage")
	dispatch               = usr.NewProc("DispatchMessageW")
	postQuit               = usr.NewProc("PostQuitMessage")
	destroy                = usr.NewProc("DestroyWindow")
	postMessage            = usr.NewProc("PostMessageW")
	invalidate             = usr.NewProc("InvalidateRect")
	beginPaint             = usr.NewProc("BeginPaint")
	endPaint               = usr.NewProc("EndPaint")
	getClientRect          = usr.NewProc("GetClientRect")
	drawText               = usr.NewProc("DrawTextW")
	setBkMode              = gdi.NewProc("SetBkMode")
	setTextColor           = gdi.NewProc("SetTextColor")
	createBrush            = gdi.NewProc("CreateSolidBrush")
	fillRect               = usr.NewProc("FillRect")
	deleteObj              = gdi.NewProc("DeleteObject")
	createFont             = gdi.NewProc("CreateFontW")
	selectObject           = gdi.NewProc("SelectObject")
	createCompatibleDC     = gdi.NewProc("CreateCompatibleDC")
	deleteDC               = gdi.NewProc("DeleteDC")
	createCompatibleBitmap = gdi.NewProc("CreateCompatibleBitmap")
	bitBlt                 = gdi.NewProc("BitBlt")
	setTimer               = usr.NewProc("SetTimer")
	killTimer              = usr.NewProc("KillTimer")
	setCursor              = usr.NewProc("SetCursor")
	loadCursor             = usr.NewProc("LoadCursorW")
	getModule              = kern.NewProc("GetModuleHandleW")
	loadIcon               = usr.NewProc("LoadIconW")
	dwmDark                = syscall.NewLazyDLL("dwmapi.dll").NewProc("DwmSetWindowAttribute")
	setDpiContext          = usr.NewProc("SetProcessDpiAwarenessContext")
	setDPIAware            = usr.NewProc("SetProcessDPIAware")
	getDpiForWindow        = usr.NewProc("GetDpiForWindow")
	moveWindow             = usr.NewProc("MoveWindow")
	callback               = syscall.NewCallback(wndProc)
	runningWindow          *Window
)

func utf(s string) uintptr        { return uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(s))) }
func color(r, g, b uint8) uintptr { return uintptr(uint32(r) | uint32(g)<<8 | uint32(b)<<16) }

var (
	bg         = color(14, 13, 13)
	panel      = color(27, 23, 21)
	border     = color(69, 50, 37)
	bright     = color(246, 242, 237)
	muted      = color(171, 160, 151)
	orange     = color(255, 157, 24)
	orangeDark = color(72, 46, 23)
	green      = color(88, 214, 155)
)

func New(title, heading, subtitle string) *Window {
  // Visual identity only. Setup, uninstall and updater retain all existing
  // buttons, confirmation flows, progress events and file handling behavior.
  role:="SETUP"
  lower:=strings.ToLower(title)
  if strings.Contains(lower,"uninstall"){role="UNINSTALL"} else if strings.Contains(lower,"update"){role="UPDATE"}
  return &Window{Title:title,Heading:heading,Subtitle:subtitle,Role:role,Stage:"READY",Status:"",Progress:0,ShowProgress:true,ShowLog:true}
}
func (w *Window) Update(stage, status string, progress float64) {
	w.mu.Lock()
	w.Stage = stage
	w.Status = status
	w.Progress = progress
	w.mu.Unlock()
	w.refresh()
}
func (w *Window) AddLog(s string) {
	w.mu.Lock()
	for _, line := range strings.Split(strings.ReplaceAll(s, "\r", ""), "\n") {
		if line != "" {
			w.Log = append(w.Log, line)
		}
	}
	if len(w.Log) > 70 {
		w.Log = w.Log[len(w.Log)-70:]
	}
	w.mu.Unlock()
	w.refresh()
}
func (w *Window) SetButtons(btns ...Button) {
	w.mu.Lock()
	w.Buttons = btns
	w.mu.Unlock()
	w.refresh()
}
func (w *Window) Close() {
	w.mu.Lock()
	h := w.Hwnd
	w.mu.Unlock()
	if h != 0 {
		postMessage.Call(h, wmClose, 0, 0)
	}
}
func (w *Window) refresh() {
	w.mu.Lock()
	h := w.Hwnd
	w.mu.Unlock()
	if h != 0 {
		postMessage.Call(h, wmApp, 0, 0)
	}
}
func (w *Window) Run() error {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	if runningWindow != nil {
		return fmt.Errorf("a KS setup window is already open")
	}
	// PER_MONITOR_AWARE_V2; fallback on old Windows versions.
	if r, _, _ := setDpiContext.Call(^uintptr(3)); r == 0 {
		setDPIAware.Call()
	}
	inst, _, _ := getModule.Call(0)
	cursor, _, _ := loadCursor.Call(0, 32512)
	name := utf("KSClientSetupModern115")
	icon, _, _ := loadIcon.Call(inst, 1)
	cls := wndClass{Size: uint32(unsafe.Sizeof(wndClass{})), Proc: callback, Instance: inst, Cursor: cursor, Icon: icon, SmallIcon: icon, Name: name}
	register.Call(uintptr(unsafe.Pointer(&cls)))
	// Windows scales the entire window using the per-monitor DPI-aware process.
	w.mu.Lock()
	title := w.Title
	w.mu.Unlock()
	h, _, err := create.Call(0, name, utf(title), wsOverlappedWindow|wsVisible|wsClipChildren, 190, 110, 900, 660, 0, 0, inst, 0)
	if h == 0 {
		return fmt.Errorf("cannot create setup window: %v", err)
	}
	runningWindow = w
	dark := int32(1)
	dwmDark.Call(h, 20, uintptr(unsafe.Pointer(&dark)), 4)
	w.mu.Lock()
	w.Hwnd = h
	w.mu.Unlock()
	dpi, _, _ := getDpiForWindow.Call(h)
	if dpi < 96 {
		dpi = 96
	}
	moveWindow.Call(h, 190, 110, uintptr(scale(dpi, 900)), uintptr(scale(dpi, 660)), 1)
	setTimer.Call(h, 1, 60, 0)
	var m msg
	for {
		r, _, _ := getMessage.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(r) <= 0 {
			break
		}
		translate.Call(uintptr(unsafe.Pointer(&m)))
		dispatch.Call(uintptr(unsafe.Pointer(&m)))
	}
	runningWindow = nil
	return nil
}
func wndProc(hwnd, message, wp, lp uintptr) uintptr {
	w := runningWindow
	if w == nil {
		return def(hwnd, message, wp, lp)
	}
	switch message {
	case wmPaint:
		drawWindow(w, hwnd)
		return 0
	case wmEraseBkgnd:
		// WM_PAINT paints every pixel into an offscreen bitmap, avoiding flashing.
		return 1
	case wmApp:
		w.mu.Lock()
		w.dirty = true
		w.mu.Unlock()
		return 0
	case wmSize:
		invalidate.Call(hwnd, 0, 0)
		return 0
	case wmDpiChanged:
		if lp != 0 {
			proposed := (*rect)(unsafe.Pointer(lp))
			moveWindow.Call(hwnd, uintptr(proposed.Left), uintptr(proposed.Top), uintptr(proposed.Right-proposed.Left), uintptr(proposed.Bottom-proposed.Top), 1)
		}
		invalidate.Call(hwnd, 0, 0)
		return 0
	case wmTimer:
		w.mu.Lock()
		// Coalesce many log/progress messages into one repaint (at most 17 Hz).
		animate := w.ShowProgress && w.Progress < 0
		if animate {
			w.tick++
		}
		redraw := w.dirty || animate
		w.dirty = false
		w.mu.Unlock()
		if redraw {
			invalidate.Call(hwnd, 0, 0)
		}
		return 0
	case wmLButtonUp:
		x, y := int32(int16(lp&0xffff)), int32(int16((lp>>16)&0xffff))
		w.mu.Lock()
		id := ""
		for i, r := range w.buttonRects {
			if x >= r.Left && x < r.Right && y >= r.Top && y < r.Bottom && i < len(w.Buttons) && w.Buttons[i].Enabled {
				id = w.Buttons[i].ID
				break
			}
		}
		action := w.OnButton
		w.mu.Unlock()
		if id != "" && action != nil {
			action(id)
		}
		return 0
	case wmClose:
		w.mu.Lock()
		w.closed = true
		w.mu.Unlock()
		killTimer.Call(hwnd, 1)
		destroy.Call(hwnd)
		return 0
	case wmDestroy:
		postQuit.Call(0)
		return 0
	}
	return def(hwnd, message, wp, lp)
}
func def(hwnd, msg, wp, lp uintptr) uintptr { r, _, _ := defProc.Call(hwnd, msg, wp, lp); return r }
func scale(dpi uintptr, n int32) int32 {
	if dpi < 96 {
		dpi = 96
	}
	return int32((int64(n)*int64(dpi) + 48) / 96)
}
func brushFill(dc uintptr, rc rect, c uintptr) {
	b, _, _ := createBrush.Call(c)
	fillRect.Call(dc, uintptr(unsafe.Pointer(&rc)), b)
	deleteObj.Call(b)
}
func label(dc uintptr, s string, rc rect, size int32, c uintptr, flags uintptr, heavy bool) {
	if s == "" {
		return
	}
	weight := uintptr(400)
	if heavy {
		weight = 650
	}
	dpi := currentDPI
	f, _, _ := createFont.Call(uintptr(int32(-scale(dpi, size))), 0, 0, 0, weight, 0, 0, 0, 1, 0, 0, 5, 0, utf("Segoe UI"))
	old, _, _ := selectObject.Call(dc, f)
	setBkMode.Call(dc, transparent)
	setTextColor.Call(dc, c)
	drawText.Call(dc, utf(s), ^uintptr(0), uintptr(unsafe.Pointer(&rc)), flags|dtNoPrefix)
	selectObject.Call(dc, old)
	deleteObj.Call(f)
}

var currentDPI uintptr = 96

func drawWindow(w *Window, h uintptr) {
	var ps paintStruct
	paintDC, _, _ := beginPaint.Call(h, uintptr(unsafe.Pointer(&ps)))
	if paintDC == 0 {
		return
	}
	defer endPaint.Call(h, uintptr(unsafe.Pointer(&ps)))
	var rc rect
	getClientRect.Call(h, uintptr(unsafe.Pointer(&rc)))
	if rc.Right <= 0 || rc.Bottom <= 0 {
		return
	}
	// Draw once to an off-screen bitmap and copy it to the window in one BitBlt.
	// This avoids exposing intermediate background/button paints during resize.
	memDC, _, _ := createCompatibleDC.Call(paintDC)
	if memDC == 0 {
		return
	}
	defer deleteDC.Call(memDC)
	bitmap, _, _ := createCompatibleBitmap.Call(paintDC, uintptr(rc.Right), uintptr(rc.Bottom))
	if bitmap == 0 {
		return
	}
	oldBitmap, _, _ := selectObject.Call(memDC, bitmap)
	defer func() {
		selectObject.Call(memDC, oldBitmap)
		deleteObj.Call(bitmap)
	}()
	dc := memDC
	defer func() {
		bitBlt.Call(paintDC, 0, 0, uintptr(rc.Right), uintptr(rc.Bottom), memDC, 0, 0, srccopy)
	}()
	dpi, _, _ := getDpiForWindow.Call(h)
	if dpi == 0 {
		dpi = 96
	}
	currentDPI = dpi
	unit := func(n int32) int32 { return scale(dpi, n) }
	width, height := rc.Right, rc.Bottom
	w.mu.Lock()
	heading, subtitle, body, stage, status, progress := w.Heading, w.Subtitle, w.Body, w.Stage, w.Status, w.Progress
	lines := append([]string{}, w.Log...)
	buttons := append([]Button{}, w.Buttons...)
	showProg, showLog, tick := w.ShowProgress, w.ShowLog, w.tick
	w.mu.Unlock()
	brushFill(dc, rc, bg)
	// Beta 1.0.3 visual language: near-black canvas, amber active marks,
	// restrained glass-like panels, consistent with the main Settings UI.
	top := unit(28)
	left := unit(36)
	right := width - unit(36)
	brushFill(dc, rect{0,0,width,unit(4)}, orange)
	brushFill(dc, rect{left,top,right,top+unit(68)},panel)
	brushFill(dc, rect{left,top,left+unit(3),top+unit(68)},orange)
	brand := rect{left+unit(15),top+unit(12),left+unit(59),top+unit(56)}
	brushFill(dc, brand, orange)
	label(dc, "KS", brand, 20, bg, dtCenter|dtVCenter|dtSingleLine, true)
	label(dc,"KS CLIENT",rect{left+unit(73),top+unit(9),left+unit(343),top+unit(36)},20,bright,dtLeft|dtVCenter|dtSingleLine,true)
	label(dc,"BETA 1.0.3  •  WINDOWS",rect{left+unit(74),top+unit(37),left+unit(343),top+unit(57)},10,muted,dtLeft|dtVCenter|dtSingleLine,false)
	role := w.Role
	if role=="" {role="SETUP"}
	chip:=rect{right-unit(151),top+unit(17),right-unit(14),top+unit(51)}
	brushFill(dc,chip,orangeDark)
	label(dc,role,chip,11,orange,dtCenter|dtVCenter|dtSingleLine,true)
	bar := rect{left,top+unit(80),right,top+unit(82)}
	brushFill(dc,bar,border)
	y := top + unit(102)
	label(dc, heading, rect{left, y, right, y + unit(40)}, 25, bright, dtLeft|dtSingleLine, true)
	y += unit(43)
	label(dc, subtitle, rect{left, y, right, y + unit(50)}, 13, muted, dtWordBreak, false)
	y += unit(63)
	if showProg {
		label(dc, stage, rect{left, y, right, y + unit(23)}, 12, orange, dtSingleLine, true)
		y += unit(26)
		label(dc, status, rect{left, y, right, y + unit(40)}, 13, bright, dtWordBreak, false)
		y += unit(45)
		pr := rect{left, y, right, y + unit(16)}
		brushFill(dc, pr, orangeDark)
		brushFill(dc, rect{pr.Left,pr.Top,pr.Right,pr.Top+unit(1)},border)
		p := progress
		if p >= 0 {
			if p > 1 {
				p = 1
			}
			if p < 0 {
				p = 0
			}
			pr.Right = left + int32(float64(right-left)*p)
			brushFill(dc, pr, orange)
		} else {
			available := right - left
			span := available / 4
			start := left + int32((tick*12)%int((available-span)+1))
			pr.Left = start
			pr.Right = start + span
			brushFill(dc, pr, orange)
		}
		if progress >= 0 {
			label(dc, fmt.Sprintf("%d%%", int(progress*100+.5)), rect{left, y + unit(19), right, y + unit(39)}, 11, muted, dtLeft|dtSingleLine, false)
		} else {
			label(dc, "WORKING…", rect{left, y + unit(19), right, y + unit(39)}, 11, muted, dtLeft|dtSingleLine, false)
		}
		y += unit(62)
	}
	bottomButtons := height - unit(95)
	if showLog {
		panelRect := rect{left, y, right, bottomButtons - unit(13)}
		brushFill(dc, panelRect, panel)
		brushFill(dc,rect{panelRect.Left,panelRect.Top,panelRect.Right,panelRect.Top+unit(1)},border)
		brushFill(dc,rect{panelRect.Left,panelRect.Top,panelRect.Left+unit(3),panelRect.Bottom},orangeDark)
		label(dc, "INSTALLATION ACTIVITY", rect{left + unit(17), y + unit(12), right, y + unit(40)}, 11, orange, dtSingleLine, true)
		maxLines := int((panelRect.Bottom - (y + unit(45))) / unit(23))
		if maxLines < 0 {
			maxLines = 0
		}
		if len(lines) > maxLines {
			lines = lines[len(lines)-maxLines:]
		}
		yy := y + unit(44)
		for _, line := range lines {
			if len([]rune(line)) > 110 {
				line = string([]rune(line)[:107]) + "..."
			}
			label(dc, line, rect{left + unit(18), yy, right - unit(13), yy + unit(22)}, 11, muted, dtSingleLine, false)
			yy += unit(23)
		}
	} else if body != "" {
		label(dc, body, rect{left, y, right, bottomButtons - unit(13)}, 14, bright, dtWordBreak, false)
	}
	// bottom action bar
	brushFill(dc, rect{0, height - unit(82), width, height}, panel)
	brushFill(dc, rect{0,height-unit(82),width,height-unit(81)},border)
	label(dc,"KS CLIENT  •  BETA 1.0.3",rect{left,height-unit(68),left+unit(270),height-unit(30)},11,muted,dtLeft|dtVCenter|dtSingleLine,false)
	w.mu.Lock()
	w.buttonRects = w.buttonRects[:0]
	bw := unit(196)
	gap := unit(13)
	total := int32(len(buttons))*bw + int32(len(buttons)-1)*gap
	x := right - total
	for _, b := range buttons {
		r := rect{x, height - unit(67), x + bw, height - unit(23)}
		c := orangeDark
		t := bright
		if !b.Enabled {
			c = border
			t = muted
		} else if b.ID == "continue" || b.ID == "start" || b.ID == "launch" || b.ID == "yes" || b.ID == "retry" {
			c = orange
			t = bg
		}
		brushFill(dc,r,border)
		inner:=rect{r.Left+unit(1),r.Top+unit(1),r.Right-unit(1),r.Bottom-unit(1)}
		brushFill(dc,inner,c)
		label(dc,b.Label,r,13,t,dtCenter|dtVCenter|dtSingleLine,true)
		w.buttonRects = append(w.buttonRects, r)
		x += bw + gap
	}
	w.mu.Unlock()
}

// Ask shows the same non-selectable themed English button dialog as setup.
func Ask(title, heading, body string, choices ...Button) string {
	w := New(title, heading, "KS Client • confirmation")
	w.ShowProgress = false
	w.ShowLog = false
	w.Body = body
	for i := range choices {
		choices[i].Enabled = true
	}
	w.SetButtons(choices...)
	var chosen string
	w.OnButton = func(id string) { chosen = id; w.Close() }
	_ = w.Run()
	return chosen
}
func Alert(title, body string) { Ask(title, "KS Client", body, Button{Label: "OK", ID: "ok"}) }
