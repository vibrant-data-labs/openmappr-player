dataCache = {}

def hasCachedResponseData(datasetId, networkId):
    if datasetId != None and networkId != None:
        if datasetId in dataCache:
            return networkId in dataCache[datasetId]
    return False

def getCachedResponseData(datasetId, networkId):
    if datasetId != None and networkId != None:
        if datasetId in dataCache:
            cache = dataCache[datasetId]
            if networkId in cache:
                print("[getCachedResponseData] Got cached response data")
                return cache[networkId]
    print("[getCachedResponseData] didn't find %s, %s"%(datasetId, networkId))
    return None

def addCachedResponseData(responseData, datasetId, networkId):
    if datasetId != None and networkId != None and responseData != None:
        if datasetId not in dataCache:
            dataCache[datasetId] = {}
        dataCache[datasetId][networkId] = responseData
        print("[addCachedResponseData] added %s, %s"%(datasetId, networkId))

def removeCachedResponseData(datasetId, networkId):
    if datasetId != None and networkId != None:
        if datasetId in dataCache:
            cache = dataCache[datasetId]
            if networkId in cache:
                del cache[networkId]
                if len(cache) == 0:
                    del dataCache[datasetId]

