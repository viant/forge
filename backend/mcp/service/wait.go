package service

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/tidwall/gjson"
)

type UIWaitInput struct {
	ClientID        string       `json:"clientId,omitempty"`
	TimeoutMs       int          `json:"timeoutMs,omitempty"`
	WaitForChange   bool         `json:"waitForChange,omitempty"`
	Predicate       *UIPredicate `json:"predicate,omitempty"`
	IncludeSnapshot bool         `json:"includeSnapshot,omitempty"`
}

type UIWaitOutput struct {
	ClientID string          `json:"clientId"`
	Matched  bool            `json:"matched"`
	Changed  bool            `json:"changed,omitempty"`
	Reason   string          `json:"reason,omitempty"`
	Snapshot json.RawMessage `json:"snapshot,omitempty"`
}

type UIPredicate struct {
	All []UICondition `json:"all,omitempty"`
	Any []UICondition `json:"any,omitempty"`
}

type UICondition struct {
	Path     string          `json:"path"`
	Exists   *bool           `json:"exists,omitempty"`
	Equals   json.RawMessage `json:"equals,omitempty"`
	Contains string          `json:"contains,omitempty"`
	Regex    string          `json:"regex,omitempty"`
}

type compiledPredicate struct {
	all []compiledCondition
	any []compiledCondition
}

type compiledCondition struct {
	path     string
	exists   *bool
	equals   *gjson.Result
	contains string
	re       *regexp.Regexp
}

func compilePredicate(p *UIPredicate) (*compiledPredicate, error) {
	if p == nil {
		return nil, nil
	}
	cp := &compiledPredicate{}
	for _, c := range p.All {
		cc, err := compileCondition(c)
		if err != nil {
			return nil, err
		}
		cp.all = append(cp.all, cc)
	}
	for _, c := range p.Any {
		cc, err := compileCondition(c)
		if err != nil {
			return nil, err
		}
		cp.any = append(cp.any, cc)
	}
	return cp, nil
}

func compileCondition(c UICondition) (compiledCondition, error) {
	if strings.TrimSpace(c.Path) == "" {
		return compiledCondition{}, errors.New("predicate condition requires path")
	}
	cc := compiledCondition{
		path:     c.Path,
		exists:   c.Exists,
		contains: c.Contains,
	}
	if len(c.Equals) > 0 {
		res := gjson.ParseBytes(c.Equals)
		cc.equals = &res
	}
	if strings.TrimSpace(c.Regex) != "" {
		re, err := regexp.Compile(c.Regex)
		if err != nil {
			return compiledCondition{}, err
		}
		cc.re = re
	}
	return cc, nil
}

func (p *compiledPredicate) match(raw json.RawMessage) (bool, string) {
	if p == nil {
		return true, "no predicate"
	}
	if raw == nil {
		return false, "no snapshot"
	}
	text := string(raw)

	for _, c := range p.all {
		ok, reason := c.match(text)
		if !ok {
			return false, "all: " + reason
		}
	}
	if len(p.any) > 0 {
		for _, c := range p.any {
			ok, _ := c.match(text)
			if ok {
				return true, "any: matched"
			}
		}
		return false, "any: no match"
	}
	return true, "all: matched"
}

func (c *compiledCondition) match(snapshotText string) (bool, string) {
	val := gjson.Get(snapshotText, c.path)
	if c.exists != nil {
		if *c.exists && !val.Exists() {
			return false, "missing " + c.path
		}
		if !*c.exists && val.Exists() {
			return false, "unexpected " + c.path
		}
	}
	if c.equals != nil {
		if !typedEquals(val, *c.equals) {
			return false, "not equals " + c.path
		}
	}
	if c.contains != "" {
		if !strings.Contains(val.String(), c.contains) {
			return false, "not contains " + c.path
		}
	}
	if c.re != nil {
		if !c.re.MatchString(val.String()) {
			return false, "regex mismatch " + c.path
		}
	}
	return true, "ok"
}

func typedEquals(actual gjson.Result, expected gjson.Result) bool {
	switch expected.Type {
	case gjson.Number:
		return actual.Type == gjson.Number && actual.Num == expected.Num
	case gjson.True, gjson.False:
		return actual.Type == expected.Type
	case gjson.Null:
		return !actual.Exists() || actual.Type == gjson.Null
	case gjson.String:
		return actual.String() == expected.String()
	default:
		return strings.TrimSpace(actual.Raw) == strings.TrimSpace(expected.Raw)
	}
}

func (s *Service) UIWait(ctx context.Context, in *UIWaitInput) (*UIWaitOutput, error) {
	if in == nil {
		in = &UIWaitInput{}
	}
	timeout := 15 * time.Second
	if in.TimeoutMs > 0 {
		timeout = time.Duration(in.TimeoutMs) * time.Millisecond
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	ns, _ := s.ns.Namespace(ctx)

	clientID := in.ClientID
	if clientID == "" {
		if id, ok := s.hub.DefaultClient(ns); ok {
			clientID = id
		} else {
			return &UIWaitOutput{ClientID: "", Matched: false, Reason: "no UI clients connected"}, nil
		}
	}

	cp, err := compilePredicate(in.Predicate)
	if err != nil {
		return nil, err
	}

	initial := s.hub.Snapshot(ns, clientID)
	if cp != nil {
		if ok, reason := cp.match(initial); ok {
			out := &UIWaitOutput{ClientID: clientID, Matched: true, Reason: reason}
			if in.IncludeSnapshot {
				out.Snapshot = initial
			}
			return out, nil
		}
	}

	if !in.WaitForChange && cp == nil {
		return &UIWaitOutput{ClientID: clientID, Matched: false, Reason: "no predicate and waitForChange=false"}, nil
	}

	updates, cancelSub := s.hub.SubscribeSnapshots(ns, clientID)
	defer cancelSub()

	baseline := string(initial)
	for {
		select {
		case <-ctx.Done():
			return &UIWaitOutput{ClientID: clientID, Matched: false, Reason: "timeout"}, nil
		case snap, ok := <-updates:
			if !ok {
				return &UIWaitOutput{ClientID: clientID, Matched: false, Reason: "subscription closed"}, nil
			}
			changed := baseline != string(snap)
			if in.WaitForChange && changed && cp == nil {
				out := &UIWaitOutput{ClientID: clientID, Matched: true, Changed: true, Reason: "snapshot changed"}
				if in.IncludeSnapshot {
					out.Snapshot = snap
				}
				return out, nil
			}
			if cp != nil {
				if ok, reason := cp.match(snap); ok {
					out := &UIWaitOutput{ClientID: clientID, Matched: true, Changed: changed, Reason: reason}
					if in.IncludeSnapshot {
						out.Snapshot = snap
					}
					return out, nil
				}
			}
			if changed {
				baseline = string(snap)
			}
		}
	}
}
