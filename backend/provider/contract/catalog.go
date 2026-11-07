package primitive

import shared "github.com/viant/mcp/client/catalog/index"

const MaxCatalogPageSize = shared.MaxCatalogPageSize

type CatalogQuery = shared.CatalogQuery
type CatalogPage[T any] = shared.CatalogPage[T]
type CatalogItem[T any] = shared.CatalogItem[T]
type Catalog[T any] = shared.Catalog[T]

var ErrCatalogCursor = shared.ErrCatalogCursor

func NewCatalog[T any](snapshot string, items []CatalogItem[T]) *Catalog[T] {
	return shared.NewCatalog(snapshot, items)
}
