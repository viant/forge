package file

type options struct {
	uri        string
	onlyFolder bool
}

func newOptions(opts ...Option) *options {
	o := &options{}
	for _, opt := range opts {
		opt(o)
	}
	return o
}

// Option is a function that modifies options
type Option func(*options)

// WithURI sets the URI for the options
func WithURI(uri string) Option {
	return func(o *options) {
		o.uri = uri
	}
}

// WithOnlyFolder sets the onlyFolder option
func WithOnlyFolder(onlyFolder bool) Option {
	return func(o *options) {
		o.onlyFolder = onlyFolder
	}
}
