//go:build windows

package main

import "ksclient/ksui"

type dialogButton struct {
	label string
	id    int
}

func askEnglish(title, body string, options ...dialogButton) int {
	btns := make([]ksui.Button, 0, len(options))
	for _, opt := range options {
		btns = append(btns, ksui.Button{Label: opt.label, ID: fmtID(opt.id)})
	}
	selected := ksui.Ask(title, "KS Client Setup", body, btns...)
	for _, o := range options {
		if fmtID(o.id) == selected {
			return o.id
		}
	}
	return 2
}
func fmtID(n int) string {
	switch n {
	case 6:
		return "yes"
	case 7:
		return "no"
	case 4:
		return "retry"
	case 2:
		return "cancel"
	default:
		return "ok"
	}
}
