// SPDX-License-Identifier: Apache-2.0
package resource

// PublishedMetadataConnections returns trusted registration locators. These are
// routing restrictions for typed consumers, never authority to read a body.
func (g *Gateway) PublishedMetadataConnections() []Connection {
	var result []Connection
	for _, source := range g.publishedRegistrations() {
		connection := source.connection
		connection.Generation = g.generation(connection.Name)
		result = append(result, connection)
	}
	return result
}
