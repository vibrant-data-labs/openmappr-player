# Databricks notebook source exported at Sat, 7 May 2016 16:46:36 UTC
# MAGIC %md
# MAGIC Sanitized csv file to paraquet file writer
# MAGIC #NOTES
# MAGIC here, I read the temp data and split out parquet data for the given file.
# MAGIC 
# MAGIC also, if the file has already been processed, then we don't process it again. For this, we store a marker file alongwith written paraquet file.
# MAGIC 
# MAGIC ## steps
# MAGIC 1. load file with correct options.
# MAGIC 2. fix column names
# MAGIC 3. mark empty cells as nulls.
# MAGIC 4. write out paraquet file.
# MAGIC 
# MAGIC ## inputs
# MAGIC - source file path
# MAGIC - dest file path
# MAGIC - schema structure
# MAGIC - delimiter
# MAGIC - whether it contains header or not.

# COMMAND ----------

import datetime
import time
from pyspark import SparkContext
from pyspark.sql import SQLContext
from pyspark.sql.window import Window
from pyspark.sql.types import *
import pyspark.sql.functions as F

# COMMAND ----------
# Arguments
# delimiter = '\t'
# srcFilePath = raw_data[dataName]
# destParquetFilePath = parquet_data[dataName]
# creation date of this file is checked. if it is newer than srcFilePath, then import process is skipped
# fileMarkerPath = parquet_data[dataName] +'-marker'

sqlContext.clearCache()

# COMMAND ----------

dataSchema = StructType([
    StructField('merchant',StringType(), False), 
    StructField('userID', LongType(), False), 
    StructField('orderDate', StringType(), True), 
    StructField('orderID', IntegerType(), False), 
    StructField('itemID', IntegerType(), False), 
    StructField('quantity', DoubleType(), True),
    StructField('spend', DoubleType(), True), 
    StructField('projWt', DoubleType(), True),
    StructField('brand', StringType(), True), 
    StructField('category', StringType(), True),
    StructField('state', StringType(), True),
    StructField('zipCode', IntegerType(), True),
    StructField('gender', StringType(), True),
    StructField('birthYrMo', IntegerType(), True),
    StructField('ethnicity', StringType(), True),	
    StructField('education', StringType(), True),
    StructField('hhIncome', StringType(), True),
    StructField('NumAdults', IntegerType(), True),
    StructField('NumPPL', IntegerType(), True),
    StructField('Marital', StringType(), True)])

# COMMAND ----------

def set_schema(df, dataSchema):
  old_new_name_tuple = zip(df.columns, [(f.name,f.dataType) for f in dataSchema.fields])
  df = df.select([F.col(x).cast(new_type).alias(new_name) for x,(new_name, new_type) in old_new_name_tuple])
  return df

# COMMAND ----------

def fix_null(x):
  return F.when(F.col(x).isNotNull() & (F.lower(F.col(x)) != "null") & (F.ltrim(F.col(x)) != ""), F.col(x)).otherwise(None)


def sanitize_data(df, dataSchema):
  # fix nulls because CSV parser isn't doing it
  # convert "NULL" and "" string values for all StringType columns into None
  columns_to_fix = set(filter(None, [x.name if x.dataType == StringType() else None for x in dataSchema.fields]))
  df = df.select([fix_null(x).alias(x) if x in columns_to_fix else x for x in df.columns])
  return df

# COMMAND ----------

def import_data(src_url, dest_url, delimiter='\t', header=False):
  print "sanitizing file: %s and writing to: %s" % (src_url, dest_url)
  #sanitize data and store as paraquet file
  if delimiter:
    df = sqlContext.read.format('com.databricks.spark.csv').options(header=header, delimiter=delimiter).load(src_url)
  else:
    df = sqlContext.read.format('com.databricks.spark.csv').options(header=header).load(src_url)
  
  # set schema
  df = set_schema(df, dataSchema)
  df = sanitize_data(df, dataSchema)

  df.write.mode("overwrite").parquet(dest_url, mode="overwrite")
  print "transaction data written to: %s" % dest_url
  return dest_url

# COMMAND ----------

import_data(srcFilePath, destParquetFilePath, delimiter, False)
