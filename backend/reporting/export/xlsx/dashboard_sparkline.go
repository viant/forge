package xlsx

import (
	"fmt"

	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

func dashboardSparkline(block reportfill.Block) *reportfill.Block {
	if block.KPIContent == nil || block.KPIContent.Sparkline == nil {
		return nil
	}
	spark := block.KPIContent.Sparkline
	count := max(len(spark.Values), len(spark.ComparisonValues))
	if count == 0 {
		return nil
	}
	keys := []string{"current"}
	values := []any{map[string]any{"value": "current", "label": "Current", "color": "#2868a9"}}
	if len(spark.ComparisonValues) > 0 {
		keys = append(keys, "comparison")
		values = append(values, map[string]any{"value": "comparison", "label": "Comparison", "color": "#6d7e8c"})
	}
	rows := make([]map[string]any, count)
	for i := range rows {
		label := fmt.Sprintf("Observation %d", i+1)
		if i < len(spark.Labels) {
			label = spark.Labels[i]
		}
		record := map[string]any{"observation": label}
		if i < len(spark.Values) && spark.Values[i] != nil {
			record["current"] = *spark.Values[i]
		}
		if i < len(spark.ComparisonValues) && spark.ComparisonValues[i] != nil {
			record["comparison"] = *spark.ComparisonValues[i]
		}
		rows[i] = record
	}
	model := map[string]any{"type": "line", "series": map[string]any{"values": values}}
	return &reportfill.Block{ID: block.ID, Kind: "chartBlock", Title: firstText(block.Title, block.KPIContent.Title) + " trend", ChartContent: &reportfill.ChartContent{ChartModel: model, ResolvedChart: &reportfill.ResolvedChart{Kind: "directSeries", Type: "line", XAxisKey: "observation", SeriesKeys: keys, Rows: rows}}}
}

func miniChart(chart *excelize.Chart) {
	chart.Legend.Position = "none"
	chart.XAxis.None = true
	chart.YAxis.None = true
	chart.YAxis.MajorGridLines = false
	chart.Fill = excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"FFFFFF"}, Transparency: 100}
	chart.PlotArea.Fill = chart.Fill
	chart.Border.Type = 2 // no border in Excelize 2.10 and 2.11
	for i := range chart.Series {
		chart.Series[i].Line.Smooth = false
		chart.Series[i].Line.Width = 1.75
		chart.Series[i].Marker.Symbol = "circle"
		chart.Series[i].Marker.Size = 2
		if i > 0 {
			chart.Series[i].Line.Dash = 3
			chart.Series[i].Line.Width = 1.25
		} // native dash in Excelize 2.10 and 2.11
	}
}
