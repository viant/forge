package types

import "testing"

func TestUploadFileTransportRequiresPreparation(t *testing.T) {
	upload := &UploadCollectionSpec{Transport: "files", Upload: &MutationCommand{DataSourceRef: "upload"}}
	window := &Window{View: View{Content: &Container{UploadCollection: upload}}}
	if err := ValidateResourceModelStructure(window); err == nil {
		t.Fatal("raw file transport without preparation accepted")
	}
	upload.Upload.Prepare = "Upload.transfer"
	if err := ValidateResourceModelStructure(window); err != nil {
		t.Fatal(err)
	}
	upload.Transport = "unknown"
	if err := ValidateResourceModelStructure(window); err == nil {
		t.Fatal("unsupported transport accepted")
	}
}
