# -*- coding: utf-8 -*-
"""
Created on Fri Aug 15 11:47:26 2014

@author: rich
"""

import xlrd
import networkx as nx

def getCellValue(cell):
    if( cell.ctype == 2 ):
        val = cell.value
        intval = int(val)
        if intval == val:
            return intval
    return cell.value

# read in a two-sheet excel file
# and build a networkx network object
#
def XLStoNetwork(dataFile, nodeSheetName='Nodes', linkSheetName='Links', headerId = 'ID', fromId = 'fromID', toId = 'toID', directed=False):
    # open file as workbook
    workbook = xlrd.open_workbook(dataFile)
    nodeSheet = workbook.sheet_by_name(nodeSheetName)
    linkSheet = workbook.sheet_by_name(linkSheetName)
    # bail out if the expected sheets aren't there
    if nodeSheet == None and linkSheet == None:
        return None
    # make empty network
    network = nx.DiGraph() if directed else nx.Graph()
    # read in and process the nodes
    # get node headers
    nodeHeaders = {}
    headerRow = nodeSheet.row(0)
    for idx in range(len(headerRow)):
        nodeHeaders[headerRow[idx].value] = idx
    idIdx = nodeHeaders[headerId]
    # build the nodes
    for rowIdx in range(1, nodeSheet.nrows):
        nodeRow = nodeSheet.row(rowIdx)
        attrs = {}
        for header, idx in nodeHeaders.iteritems():
            if header != headerId:
                attrs[header] = getCellValue(nodeRow[idx])
        network.add_node(getCellValue(nodeRow[idIdx]), attrs)
    # read in and process the links
    # get link headers
    linkHeaders = {}
    headerRow = linkSheet.row(0)
    for idx in range(len(headerRow)):
        linkHeaders[headerRow[idx].value] = idx
    fromIdx = linkHeaders[fromId]
    toIdx = linkHeaders[toId]
    # build the links
    for rowIdx in range(1, linkSheet.nrows):
        linkRow = linkSheet.row(rowIdx)
        fromNodeId = getCellValue(linkRow[fromIdx])
        toNodeId = getCellValue(linkRow[toIdx])
        attrs = {}
        for header, idx in linkHeaders.iteritems():
            if header != fromId and header != toId:
                attrs[header] = getCellValue(linkRow[idx])
        network.add_edge(fromNodeId, toNodeId, attrs)
    return network