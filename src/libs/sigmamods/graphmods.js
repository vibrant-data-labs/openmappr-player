/** Addition methods added to the graph class */
(function(undefined) {
  'use strict';

	if (typeof sigma === 'undefined') {
		throw 'sigma is not declared';
	}
	if (typeof sigma.classes.graph === 'undefined'){
		throw 'sigma graph not found is not declared';
	}

	// gets an object {edgeId: edge} which contains all edges between n1, n2, or null if not available
	sigma.classes.graph.addMethod('getEdgesBetween', function(node1, node2) {
		return this.allNeighborsIndex[node1][node2];
	});
	sigma.classes.graph.addMethod('getAllEdges', function(nodeId) {
		return this.allNeighborsIndex[nodeId];
	});

	sigma.classes.graph.addMethod('getNodeWithId', function(nodeId) {
		return this.nodesIndex[nodeId];
	});
	sigma.classes.graph.addMethod('getNodeNeighbours', function(nodeId) {
		return this.allNeighborsIndex[nodeId];
	});
	sigma.classes.graph.addMethod('getInNodeNeighbours', function(nodeId) {
		return this.inNeighborsIndex[nodeId];
	});
	sigma.classes.graph.addMethod('getOutNodeNeighbours', function(nodeId) {
		return this.outNeighborsIndex[nodeId];
	});
	// Aggregation related indices
	sigma.classes.graph.addIndex('aggregateIndex', {
		constructor: function() {
			//NOTE: Do not store nodes here directly, as they dont' reflect rendering properties.
			// A map of aggregationNodes
			this.aggregationNodeIndex = {};
			// node Id to aggregation Node Id map
			this.aggregatedNodeToParentIndex = {};
			// Index of aggregated nodes
			this.aggregatedNodeIndex = {};
		},
		addNode: function(node) {
			if(node.isAggregation) {
				this.aggregationNodeIndex[node.id] = node.id;
				_.each(node.aggregatedNodes, function(n) {
					this.aggregatedNodeIndex[n.id] = n;
					this.aggregatedNodeToParentIndex[n.id] = node.id;
				}, this);
			}
		},
		dropNode: function(node) {
			if(node.isAggregation) {
				delete this.aggregationNodeIndex[node.id];
				_.each(node.aggregatedNodes, function(n) {
					delete this.aggregatedNodeIndex[n.id];
					delete this.aggregatedNodeToParentIndex[n.id];
				}, this);
			}
		}
	});
	/**
	 * This methods returns one or several aggregation nodes IDs, depending on how it is called.
	 *
	 * To get the array of nodes, call "nodes" without argument. To get a
	 * specific node, call it with the id of the node. The get multiple node,
	 * call it with an array of ids, and it will return the array of nodes, in
	 * the same order.
	 *
	 * @param  {?(string|array)} v Eventually one id, an array of ids.
	 * @return {object|array}      The related node or array of node IDs.
	 */
	sigma.classes.graph.addMethod('aggregationNodes', function(v) {
		if (!arguments.length)
			return _.values(this.aggregationNodeIndex);

		// Return the related node:
		if (arguments.length === 1 && typeof v === 'string')
			return this.aggregationNodeIndex[v];

		// Return an array of the related node:
		if (
			arguments.length === 1 &&
			Object.prototype.toString.call(v) === '[object Array]'
		) {
			return _.reduce(v, function(acc, nodeId) {
				if(this.aggregationNodeIndex[nodeId])
					acc.push(this.aggregationNodeIndex[v]);
				return acc;
			},[], this);
		}

		throw 'aggregationNodes: Wrong arguments.';
	});
	/**
	 * if the nodeId given is part of an aggregation, returns the aggregator Node.
	 * @param  {[type]} v [description]
	 * @return {[type]}   [description]
	 */
	sigma.classes.graph.addMethod('getParentAggrNode', function(nodeId) {
		if(this.aggregatedNodeToParentIndex[nodeId]) {
			return this.nodes(this.aggregatedNodeToParentIndex[nodeId]);
		}
		console.warn('getParentAggrNode: Wrong arguments.NodeId not aggregated');
		return null;
	});
	/**
	 * Get node in an aggregation or null if the node isn't part of any aggregation.
	 * @param  {[type]} nodeId [the node Id which has been aggregated]
	 * @return {[type]}        [the node data]
	 */
	sigma.classes.graph.addMethod('getNodeInAggr', function(nodeId) {
		if(this.aggregatedNodeIndex[nodeId]) {
			return this.aggregatedNodeIndex[nodeId];
		}
		console.warn('getNodeInAggr: Wrong arguments.NodeId not aggregated');
		return null;
	});

}).call(this);
