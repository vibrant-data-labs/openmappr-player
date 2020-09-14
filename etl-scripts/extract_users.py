# Databricks notebook source exported at Mon, 9 May 2016 14:32:04 UTC
# MAGIC %md
# MAGIC for a given list of entities, find all users who interact with them and export their information as an S3 url

# COMMAND ----------

import pyspark.sql.functions as F
from pyspark.sql.types import *

# COMMAND ----------
# injected by init script
# srcParquetFile = 
# destCSVFile = '/mnt/mappr-temp/extracted-users/users.csv'
# entity_list = ['Shutterfly']
# entity = 'merchant'
print 'srcParquetFile' , srcParquetFile 
print 'destCSVFile' , destCSVFile 
print 'entity_list' , entity_list 
print 'entity' , entity 

# consts
userID = 'userID'
userCols = ["userID", "gender", "birthYrMo", "ethnicity", "education", "hhIncome", "NumAdults", "NumPPL", "Marital"]

# COMMAND ----------

sqlContext.clearCache()
df = sqlContext.read.parquet(srcParquetFile)
df = df.filter(df[entity].isin(entity_list))
df = df.groupby(userID).agg(*([F.first(x).alias(x) for x in userCols if x != userID] + [F.collect_set(df[entity]).alias(entity)]))
df = df.withColumn(userID, F.col(userID).cast(StringType()))
df = df.withColumn(entity, F.concat_ws('|',df[entity]).alias(entity))
# COMMAND ----------

df = df.repartition(1).cache()
df.write.mode("overwrite").format('com.databricks.spark.csv').options(header='true').save(destCSVFile)
sqlContext.clearCache()
# COMMAND ----------


