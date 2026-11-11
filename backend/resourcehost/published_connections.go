// SPDX-License-Identifier: Apache-2.0
package resource

// PublishedMetadataConnections returns trusted registration locators. These are
// routing restrictions for typed consumers, never authority to read a body.
// Optional namespace filters use trusted registration claims even while a source
// is unavailable or has withdrawn its last root.
func (g *Gateway) PublishedMetadataConnections(namespaces ...string) []Connection {
	var result []Connection
	for _, source := range g.publishedRegistrations() {
		if len(namespaces) > 0 {
			matched := false
			for _, namespace := range namespaces {
				if source.namespaces[namespace] {
					matched = true
					break
				}
			}
			if !matched {
				continue
			}
		}
		connection := source.connection
		connection.Generation = g.generation(connection.Name)
		result = append(result, connection)
	}
	return result
}
