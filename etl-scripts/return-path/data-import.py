# MAGIC %md
# MAGIC # NOTES
# MAGIC ## ReturnPath Data Import Script
# MAGIC sanitizes data given by and writes out a Paraquet file
# MAGIC 
# MAGIC Datasource example: vdat-rp/rp_purchase_data_sample.gz

# COMMAND ----------

# dataName = "rtpfull"
# tab_sep = True

# raw_data = {}
# raw_data["rtpfull"] = "/mnt/vdat-rp/rp_purchase_data_sample.gz"
# raw_data["rtp50mb"] = "/mnt/vdat-rp/RTP100K.txt"

# paraquet_data = {}
# paraquet_data["rtpfull"] = "/mnt/mappr-datasets/rtp/rtp-full-paraquet"
# paraquet_data["rtp50mb"] = "/mnt/mappr-datasets/rtp/rtp-50mb-paraquet"

# srcFilePath = raw_data[dataName]
# destFilePath = paraquet_data[dataName]

# COMMAND ----------

import datetime
import math
from itertools import izip
from pyspark import SparkContext
from pyspark.sql import SQLContext
from pyspark.sql.window import Window
from pyspark.sql.types import *
import pyspark.sql.functions as F


customSchema = StructType([ \
    StructField("merchant", StringType(), False), \
    StructField("user_id", StringType(), False), \
    StructField("message_id", StringType(), True), \
    StructField("invoice_id", StringType(), True), \
    StructField("order_id", StringType(), False), \
    StructField("order_date", DateType(), True), \
    StructField("order_timestamp", TimestampType(), True), \
    StructField("order_currency", StringType(), True), \
    StructField("order_subtotal", DoubleType(), True), \
    StructField("order_total", DoubleType(), True), \
    StructField("order_shipping", DoubleType(), True), \
    StructField("order_tax", DoubleType(), True), \
    StructField("order_discount", DoubleType(), True), \
    StructField("order_giftwrap", DoubleType(), True), \
    StructField("order_donation", DoubleType(), True), \
    StructField("order_certificate", DoubleType(), True), \
    StructField("order_recycle_fee", DoubleType(), True), \
    StructField("order_payment_vendor", StringType(), True), \
    StructField("order_product_quantity", DoubleType(), True), \
    StructField("product_price", DoubleType(), True), \
    StructField("receipt_price", DoubleType(), True), \
    StructField("receipt_subtotal", DoubleType(), True), \
    StructField("receipt_total", DoubleType(), True), \
    StructField("imputed_price", DoubleType(), True), \
    StructField("imputed_subtotal", DoubleType(), True), \
    StructField("imputed_total", DoubleType(), True), \
    StructField("crawled_price", DoubleType(), True), \
    StructField("product_quantity", DoubleType(), True), \
    StructField("product_sku", StringType(), True), \
    StructField("product_title", StringType(), True), \
    StructField("product_subtitle", StringType(), True), \
    StructField("receipt_title", StringType(), True), \
    StructField("crawled_title", StringType(), True), \
    StructField("crawled_timestamp", StringType(), True), \
    StructField("product_digital_flag", DoubleType(), True), \
    StructField("product_digital_prob", DoubleType(), True), \
    StructField("in_store", IntegerType(), True), \
    StructField("product_category1_name", StringType(), True), \
    StructField("product_category1_prob", StringType(), True), \
    StructField("product_category2_name", StringType(), True), \
    StructField("product_category2_prob", StringType(), True), \
    StructField("product_category3_name", StringType(), True), \
    StructField("product_category3_prob", StringType(), True), \
    StructField("redacted", IntegerType(), True), \
    StructField("marketplace", IntegerType(), True), \
    StructField("product_id", StringType(), True), \
    StructField("product_when", StringType(), True), \
    StructField("product_where", StringType(), True), \
    StructField("seller", StringType(), True), \
    StructField("universal_product_id", StringType(), True)])

# the columns to extract from the whole dataset. These are the ones which are analysed
cols_for_etl = ['merchant', 'user_id', 'order_date', 'order_id', 'product_id', 'order_product_quantity', 'order_total', 'product_category1_name', 'redacted']
entity = 'merchant'


def fix_null(x):
	return F.when((F.col(x) != "NULL") & (F.col(x) != ""), F.col(x)).otherwise(None)
  
def sanitize_data(src_url, dest_url, tab_sep=False):
  print "sanitizing file: %s and writing it to: %s" % (src_url, dest_url)
  #sanitize data and store as paraquet file
  if tab_sep:
    df = sqlContext.read.format('com.databricks.spark.csv').options(header='false', delimiter="\t", inferSchema="true").load(src_url) #sample data loader
  else:
    df = sqlContext.read.format('com.databricks.spark.csv').options(header='true').load(src_url)
  
  #fix names and datatype of each columns
  old_new_name_tuple = zip(df.columns, [(f.name,f.dataType) for f in customSchema.fields])
  df = df.select([F.col(x).cast(new_type).alias(new_name) for x,(new_name, new_type) in old_new_name_tuple])
  
  # fix nulls because CSV parser isn't doing it
  # convert "NULL" and "" string values for all StringType columns into None
  columns_to_fix = set(filter(None, [x.name if x.dataType == StringType() else None for x in customSchema.fields]))
  df = df.select([fix_null(x).alias(x) if x in columns_to_fix else x for x in df.columns])
  
  #finally select the necessary columns
  df = df.select([x for x in cols_for_etl])
  
  # repartition for efficient computation
  df = df.repartition(24, entity)
  df.write.mode("overwrite").parquet(dest_url, mode="overwrite")
  print "sanitized file: %s and written to: %s" % (src_url, dest_url)
#   return df
  return dest_url


# COMMAND ----------  
# finally run the command, done by processor
# sanitize_data(srcFilePath, destFilePath, tab_sep)
