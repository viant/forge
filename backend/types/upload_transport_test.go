package types

import "testing"

func TestUploadFileTransportRequiresPreparation(t *testing.T) {
	upload := &UploadCollectionSpec{Transport: "files", Upload: &MutationCommand{DataSourceRef: "upload"}}
	container := &Container{UploadCollection: upload}
	if err := validateContainerResourceModels(&Window{}, container, false); err == nil {
		t.Fatal("raw file transport without preparation accepted")
	}
	upload.Upload.Prepare = "Upload.transfer"
	if err := validateContainerResourceModels(&Window{}, container, false); err != nil {
		t.Fatal(err)
	}
	upload.Transport = "unknown"
	if err := validateContainerResourceModels(&Window{}, container, false); err == nil {
		t.Fatal("unsupported transport accepted")
	}
}
