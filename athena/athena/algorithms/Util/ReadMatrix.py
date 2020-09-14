# -*- coding: utf-8 -*-

import csv
import numpy as np

# read in a csv matrix that optionally has row and column headers
# returns tuple: numpy matrix of values and optional lists of row and column ids
#
def readCSVMatrix(fileName, hasRowIds=True, hasColIds=True, delim = ',', removeIds = []):
    def removeRow(data, i):
        newdata = data[:-1,:]
        newdata[i:,:] = data[i+1:,:]
        return newdata        

    def removeColumn(data, j):
        newdata = data[:,:-1]
        newdata[:,j:] = data[:,j+1:]
        return newdata      
        
    f = open(fileName)
    rd = csv.reader(f, delimiter=delim)
    # first row - get column ids
    colidMap = {}
    if hasColIds:
        colId = rd.next()
        del colId[0]
        colidMap = {colId[i] : i for i in range(len(colId)) }
    else:
        colId = []
        colidMap = {}
    # other rows - get rowIds and data
    rowId = []
    data = []
    rowidMap = {}
    i = 0
    for row in rd:
        if hasRowIds:
            id = row.pop(0)
            rowId.append(id)
            rowidMap[id] = i
            i += 1
        data.append(map(float, row))
    f.close()
    # convert data to numpy
    data = np.array(data)
    # remove excluded rows and columns
    if len(removeIds) > 0:
        rowIdx = [rowidMap[idVal] for idVal in removeIds]
        rowIdx.sort(reverse=True)
        colIdx = [colidMap[idVal] for idVal in removeIds]
        colIdx.sort(reverse=True)
        for idx in rowIdx:
            data = removeRow(data, idx)
            del rowId[idx]
        for idx in colIdx:
            data = removeColumn(data, idx)
            del colId[idx]
    return (data, rowId, colId)
