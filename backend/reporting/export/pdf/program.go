package pdf

import (
	"fmt"
	"sort"

	reportprint "github.com/viant/forge/backend/reporting/print"
)

type documentProgram struct {
	report      *reportprint.ReportPrint
	diagnostics []RenderDiagnostic
	pages       []pageProgram
}

type pageProgram struct {
	number         int
	headerElements []elementProgram
	elements       []elementProgram
	footerElements []elementProgram
	bookmarks      []bookmarkProgram
}

type bookmarkProgram struct {
	title string
	level int
	y     float64
}

type elementProgram struct {
	element    reportprint.Element
	pageNumber int
	path       string
}

type indexedElement struct {
	element reportprint.Element
	index   int
}

func buildDocumentProgram(report *reportprint.ReportPrint) *documentProgram {
	if report == nil {
		return nil
	}
	bookmarkIndex := buildBookmarkProgramIndex(report.Bookmarks)
	pages := make([]pageProgram, 0, len(report.Pages))
	for pageIndex, page := range report.Pages {
		pages = append(pages, pageProgram{
			number:         page.Number,
			bookmarks:      bookmarkIndex[page.Number],
			headerElements: buildElementPrograms(page.HeaderElements, page.Number, "headerElements", pageIndex),
			elements:       buildElementPrograms(page.Elements, page.Number, "elements", pageIndex),
			footerElements: buildElementPrograms(page.FooterElements, page.Number, "footerElements", pageIndex),
		})
	}
	return &documentProgram{
		report:      report,
		diagnostics: translateReportPrintDiagnostics(report.Diagnostics),
		pages:       pages,
	}
}

func buildBookmarkProgramIndex(bookmarks []reportprint.Bookmark) map[int][]bookmarkProgram {
	if len(bookmarks) == 0 {
		return nil
	}
	result := map[int][]bookmarkProgram{}
	for _, bookmark := range bookmarks {
		level := 0
		if bookmark.Level > 1 {
			level = bookmark.Level - 1
		}
		result[bookmark.PageNumber] = append(result[bookmark.PageNumber], bookmarkProgram{
			title: bookmark.Title,
			level: level,
			y:     bookmark.Y,
		})
	}
	return result
}

func buildElementPrograms(elements []reportprint.Element, pageNumber int, collection string, pageIndex int) []elementProgram {
	if len(elements) == 0 {
		return nil
	}
	indexed := make([]indexedElement, 0, len(elements))
	for index, element := range elements {
		indexed = append(indexed, indexedElement{element: element, index: index})
	}
	sort.SliceStable(indexed, func(left, right int) bool {
		leftZ := 0
		rightZ := 0
		if indexed[left].element.ZIndex != nil {
			leftZ = *indexed[left].element.ZIndex
		}
		if indexed[right].element.ZIndex != nil {
			rightZ = *indexed[right].element.ZIndex
		}
		if leftZ == rightZ {
			return indexed[left].index < indexed[right].index
		}
		return leftZ < rightZ
	})
	result := make([]elementProgram, 0, len(indexed))
	for _, entry := range indexed {
		result = append(result, elementProgram{
			element:    entry.element,
			pageNumber: pageNumber,
			path:       fmt.Sprintf("$.pages[%d].%s[%d]", pageIndex, collection, entry.index),
		})
	}
	return result
}
