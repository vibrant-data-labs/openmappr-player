###
# Runs the importer
import json
result=sanitize_data(srcFilePath, destFilePath, tab_sep)
sqlContext.clearCache()
print json.dumps(result)
