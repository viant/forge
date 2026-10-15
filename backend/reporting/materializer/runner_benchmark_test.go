package materializer

import (
	"github.com/dop251/goja"
	"os"
	"testing"
)

func BenchmarkRuntimeInitialization(b *testing.B) {
	p, err := goja.Compile("forge-authored-lowerer", bundle, true)
	if err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		vm := goja.New()
		if _, err = vm.RunProgram(p); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkInitializedLowering(b *testing.B) {
	if path := os.Getenv("AGENTLY_MATERIALIZER_PROFILE"); path != "" {
		file, err := os.Create(path)
		if err != nil {
			b.Fatal(err)
		}
		if err := goja.StartProfile(file); err != nil {
			file.Close()
			b.Fatal(err)
		}
		defer func() { goja.StopProfile(); file.Close() }()
	}
	raw, err := os.ReadFile("testdata/steward/performance_delivery_command_center.json")
	if err != nil {
		b.Fatal(err)
	}
	p, err := goja.Compile("forge-authored-lowerer", bundle, true)
	if err != nil {
		b.Fatal(err)
	}
	vm := goja.New()
	if _, err = vm.RunProgram(p); err != nil {
		b.Fatal(err)
	}
	lower, ok := goja.AssertFunction(vm.Get("ForgeAuthoredLowerer").ToObject(vm).Get("lower"))
	if !ok {
		b.Fatal("missing lowerer")
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err = lower(goja.Undefined(), vm.ToValue(string(raw))); err != nil {
			b.Fatal(err)
		}
	}
}
