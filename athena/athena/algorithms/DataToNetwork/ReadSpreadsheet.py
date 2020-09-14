# -*- coding: utf-8 -*-
"""
Created on Thu Oct 30 21:52:24 2014

@author: rich
"""

import xlrd

def getDataFromSpreadsheet(dataFile, questionSheetName, responseSheetName, aggregationSheetName='Cluster_Stats'):
    def extractSheetData(workbook, sheetnames, sheet):
        if sheet in sheetnames:
            sheetData = workbook.sheet_by_name(sheet)
            return [[row.value for row in sheetData.row(rowIdx)] for rowIdx in range(sheetData.nrows)]
        return None
        
    data = {}
    workbook = xlrd.open_workbook(dataFile)
    sheetNames = workbook.sheet_names()    
    data['questions'] = extractSheetData(workbook, sheetNames, questionSheetName)
    data['responses'] = extractSheetData(workbook, sheetNames, responseSheetName)
    data['aggregation'] = extractSheetData(workbook, sheetNames, aggregationSheetName)
    workbook.release_resources()
    return data
    
import pandas as pd

def getSpreadsheetData(dataFile, questionSheetName, responseSheetName, aggregationSheetName='Cluster_Stats'):
    def extractSheetData(dataFile, sheetName):
        try:
            return pd.read_excel(dataFile, sheetName).fillna('')
        except:
            return None
            
    data = {}
    data['questions'] = extractSheetData(dataFile, questionSheetName)
    data['responses'] = extractSheetData(dataFile, responseSheetName)
    data['aggregation'] = extractSheetData(dataFile, aggregationSheetName)
    return data
    