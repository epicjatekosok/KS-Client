//go:build windows

package main

import "ksclient/ksui"

type dialogButton struct {
	label string
	id    int
}

func askEnglish(title, body string, options ...dialogButton) int {
	choices := make([]ksui.Button, 0, len(options))
	for _, option := range options {
		choices = append(choices, ksui.Button{Label: option.label, ID: fmtID(option.id)})
	}
	selection := ksui.Ask(title, "KS Client Uninstaller", body, choices...)
	for _, opt := range options {
		if selection == fmtID(opt.id) {
			return opt.id
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
