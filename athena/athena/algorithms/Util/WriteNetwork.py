# -*- coding: utf-8 -*-
"""
Created on Thu Jun 26 21:03:37 2014

@author: richwilliams
"""

import xlwt

# write network nodes, links and clustering data to an Excel (xls) file
# clusterData is a dict of {clusteringName, clusterData}
#
def writeNetwork(outFile, nodeData, linkData, clusterData=None):
    # write node or link data
    # idMap renames columns
    def writeSheet(sheet, sheetData, idMap):
        cols = sorted(sheetData[0].keys())
        row = 0
        i = 0
        for col in cols:
            if col in idMap:
                val = idMap[col]
            else:
                val = col
            sheet.write(row, i, val)
            i += 1
        row += 1;
        for item in sheetData:
            for i in range(len(cols)):
                col = cols[i]
                if col in item:
                    # print "writing col Item: %s" % item[col]
                    if isinstance(item[col], list) is True:
                        valStr = ''
                        for val in item[col]:
                            valStr += str(val)
                            valStr += ' '
                        sheet.write(row, i, valStr)
                    elif isinstance(item[col], basestring) is True:
                        #sheet.write(row, i, item[col].encode('ascii', 'ignore'))
                        sheet.write(row, i, item[col].decode('utf-8'))
                    else:    
                        sheet.write(row, i, str(item[col]))
                else:
                    print str(col) + " missing from " + str(item)
            row += 1
            
    wkbook = xlwt.Workbook(encoding='utf-8')
#    wkbook = xlwt.Workbook(encoding='latin-1')  # xlwt bug???
    nodeSheet = wkbook.add_sheet("Nodes")
    if len(nodeData) > 0:
        writeSheet(nodeSheet, nodeData, {})
    linkSheet = wkbook.add_sheet("Links")
    if len(linkData) > 0:
        writeSheet(linkSheet, linkData, {'id1': 'from', 'id2': 'to'})
    if clusterData != None:
        for clustering, data in clusterData.iteritems():
            if len(data) > 0:
                clusterSheet = wkbook.add_sheet(clustering)
                writeSheet(clusterSheet, data, {})
    wkbook.save(outFile)


# write networkx network to xls
#
def NetworktoXLS(network, outFile):
    # write node or link data
    # idMap renames columns
    def writeSheetHeader(sheet, i, vals, idMap):
        row = 0
        for val in vals:
            sheet.write(row, i, val)
            idMap[val] = i
            i += 1 
        return i
        
    def writeAttributesToSheet(sheet, row, attrs, idMap):
        for k, v in attrs.iteritems():      
            sheet.write(row, idMap[k], v)
            
    wkbook = xlwt.Workbook(encoding='utf-8')
    nodeSheet = wkbook.add_sheet("Nodes")
    if len(network) > 0:
        attrs = network.node[network.nodes()[0]].keys()
        idMap = {}
        i = writeSheetHeader(nodeSheet, 0, ['ID'], idMap)
        i = writeSheetHeader(nodeSheet, i, attrs, idMap)
        attrs = network.node[network.nodes()[0]].keys()
        row = 1
        for node in network.nodes():
            nodeSheet.write(row, idMap['ID'], node)
            writeAttributesToSheet(nodeSheet, row, network.node[node], idMap)
            row += 1
        linkSheet = wkbook.add_sheet("Links")
        if len(network.edges()) > 0:
            attrs = network.edge[network.edges()[0][0]][network.edges()[0][1]].keys()
            idMap = {}
            i = writeSheetHeader(linkSheet, 0, ['fromID', 'toID'], idMap)
            i = writeSheetHeader(linkSheet, i, attrs, idMap)
            row = 1
            for link in network.edges():
                linkSheet.write(row, idMap['fromID'], link[0])
                linkSheet.write(row, idMap['toID'], link[1])
                writeAttributesToSheet(linkSheet, row, network.edge[link[0]][link[1]], idMap)
                row += 1            
    wkbook.save(outFile)
    
