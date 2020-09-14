# Databricks notebook source exported at Thu, 14 Apr 2016 17:58:36 UTC
# MAGIC %md
# MAGIC # NOTES
# MAGIC ## ReturnPath ETL Script 
# MAGIC Processing paraquet file into entityInfo and simMat file

# COMMAND ----------
# injected by Init script
# dataName = "rtp50mb"
# srcFilePath = "/mnt/mappr-datasets/rtp/rtp-50mb-paraquet"
# destEntityInfoPath = '/mnt/mappr-temp/etl-results/%s/entityInfo.csv' % dataName
# destSimMatKey = '/etl-results/%s/simMat.pickle2' % dataName

# COMMAND ----------

import datetime
import math
from itertools import izip
import numpy as np
from pyspark import SparkContext
from pyspark import StorageLevel
from pyspark.sql import SQLContext
from pyspark.sql.window import Window
from pyspark.sql.types import *
import pyspark.sql.functions as F

from scipy.sparse import vstack
from scipy.sparse import csr_matrix
from pickle import dumps
from boto.s3.connection import S3Connection
from boto.s3.connection import Key

# COMMAND ----------

#ATTRIBUTE NAMES
merchant = 'merchant'
uID = 'user_id'
orderDate = 'order_date'
orderID = 'order_id'
itemID = 'product_id'
quantity = 'order_product_quantity'
spend = 'order_total'
category = 'product_category1_name'
redacted = 'redacted'

# constructed attributes
topCategory = 'topCategory'
subCategory = 'subCategory'
items = 'items'
# wtdorders = 'wtdorders'
growthRate = 'growthRate'

# ETL Attrs
entity = merchant
maxAttr = 100		# max number of attributes to extract
maxCat = 100
minCnt = 0

# COMMAND ----------

tableName = 'returnpath_data'

def load_data(fileurl):
  sqlContext.clearCache()
  df = sqlContext.read.parquet(fileurl) #full data loader
  df.persist(StorageLevel.MEMORY_AND_DISK_SER)
  df.registerTempTable(tableName)
  return df

# COMMAND ----------

def build_common_tbls(df):
  # calc ordering patterns of user
  orderInfoDF = df.groupBy(entity, uID, orderID) \
    .agg(#order specific stuff
         F.sum(spend).alias(spend),
         F.sum(quantity).alias(items),
         F.first(orderDate).alias(orderDate))
  
  orderInfoDF.registerTempTable('entity_user_order_tbl')
  orderInfoDF.persist(StorageLevel.MEMORY_AND_DISK_SER)
    
  # generate entity, user summary
  # there is no user specific data!
  # entityUserDF = orderInfoDF.groupby(entity, uID) \
  #   .agg(F.sum(projWt).alias('orderWt'),
  #        F.first(projWt).alias('userWt'),
  #        F.first(gender).alias(gender),
  #        F.first(ethnicity).alias(ethnicity),
  #        F.first(education).alias(education),
  #        F.first(hhIncome).alias(hhIncome),
  #        F.first(Marital).alias(Marital),
  #        F.first(birthYrMo).alias(birthYrMo),
  #        F.first(NumPPL).alias(NumPPL),
  #        F.first(NumAdults).alias(NumAdults)).repartition(12,entity)
    
  # entityUserDF.registerTempTable('entity_user_tbl')
  # entityUserDF.persist(StorageLevel.MEMORY_AND_DISK_SER)
  entityUserDF = None
  return (orderInfoDF, entityUserDF)

# COMMAND ----------

def calculate_spending_patterns(orderInfoDF):    
  # generate entity summary
  usrAggregates = orderInfoDF.groupby(entity) \
    .agg(F.countDistinct(uID).alias("nCustomers"),
      F.sum(spend).alias("spend"),
      F.count(orderID).alias("orders"))
    
  return usrAggregates

# COMMAND ----------

def brands_info(df):
  # number of brands available for each merchant
  groupInfoTbl = df.groupBy(entity) \
    .agg(F.countDistinct(category).alias("ncat"), F.avg(redacted).alias("avg_redacted"))
  return groupInfoTbl

# COMMAND ----------

def get_sub_category(cat):
  if cat is None:
    return None
  else:
    return "-".join([x.strip() for x in cat.split('-')][:2])

def removeOther(strArray):
  if len(strArray) > 1:
    return [s for s in strArray if s != "Other"]
  else:
    return strArray

removeOtherUDF = F.udf(removeOther, ArrayType(StringType()))
# window used rank each element in the group in desc order of "count", so that we can select top 100 or so
aWindow = Window.partitionBy(entity).orderBy(F.desc("count"))
  
# builder for a tag table for each entity,attr
def build_tag_tbl(attrDF, attr, pluralAttr, limitRows=100):
  # find out top rows for each entity. We do this by generating rank
  tbl = attrDF.groupBy(entity, attr).count() \
          .select(entity, attr, "count", F.row_number().over(aWindow).alias("rank")) \
          .where(F.col("rank") < limitRows) \
          .groupby(entity).agg(F.collect_list(attr).alias(pluralAttr)) #collect attrs into a single ArrayColumn

  #apply "removeOtherUDF()" to remove "other" if necessary, then concat with '|'
  tbl = tbl.select(entity, F.concat_ws("|", removeOtherUDF(tbl[pluralAttr])).alias(pluralAttr))
  return tbl

def gen_tag_info_tbl(df):
  subCat = F.udf(get_sub_category, StringType())
  # split category data and create topCategory and subcategory columns
  print("Building category attributes")
  attrDF = df.select(entity,
                     category,
                     (F.trim(F.split(F.col(category),"-")[0])).alias("topCategory"))\
            .withColumn("subCategory",subCat(df[category]))
  attrDF.registerTempTable('slice_attr_df')
  attrDF = attrDF.cache()
  
  tags_to_generate = [(attrDF, category, "categories", maxCat),
              (attrDF, topCategory, "topCategories", maxCat),
              (attrDF, subCategory, "subCategories", maxCat)]

  tagTbls = [build_tag_tbl(*x) for x in tags_to_generate]

  #the final tag tbl
  tagTbl = reduce(lambda attrDF, tbl: attrDF.join(tbl, entity, how="outer"), tagTbls)
  return tagTbl

# COMMAND ----------

def dateVal(x):
  return float(x.year) + float(x.month)/12 + float(x.day)/365

def build_frac_growth_rate_tbl(orderInfoDF):
  #udf to process orderDate into *something*
  dateValUDF = F.udf(dateVal, FloatType())
  
  df = orderInfoDF.select(entity, orderID, spend, orderDate).sort(orderDate)
  df = df.withColumn("date", dateValUDF(orderDate)).cache()
  
  # find min,max for each entity
  od = F.broadcast(df.groupby(entity).agg(F.min("date"), F.max("date")))
  # compute dateFrac which is the slope of date. i.e (date - od[0]) / (od[-1] - od[0])
  df = df.join(od, entity).withColumn("dateFrac", (df["date"] - od["min(date)"]) / (od["max(date)"] - od["min(date)"]))
  
  start = df[df["dateFrac"] < 0.25]
  end = df[df["dateFrac"] > 0.75]
  
  initSpend = start.groupby(entity).agg(F.sum(start[spend]).alias("initSpend"))
  finalSpend = end.groupby(entity).agg(F.sum(end[spend]).alias("finalSpend"))
  # calc fracGrowth Rate (finalSpend - initSpend)/initSpend if initSpend != None and finalSpend != None and initSpend > 0 else 0
  tbl = initSpend.join(finalSpend, entity)
  return tbl.select(entity, F.when(F.col("initSpend").isNotNull() & \
                                   (F.col("initSpend") > 0) & \
                                   F.col("finalSpend").isNotNull(), \
                                   (F.col("finalSpend") - F.col("initSpend")) / F.col("initSpend")).otherwise(0).alias("growthRate"))

# COMMAND ----------

def add_computed_cols(entityInfo):
  # add computed variables
  entityInfo = entityInfo.withColumn("log_ncat",F.when(entityInfo["ncat"] > 0, F.log10("ncat")).otherwise(0))
  entityInfo = entityInfo.withColumn("log_nCustomers", F.log10(entityInfo["nCustomers"]))
  entityInfo = entityInfo.withColumn("log_spend", F.log10(entityInfo["spend"] + 0.01))
  entityInfo = entityInfo.withColumn("log_orders", F.log10(entityInfo["orders"]))
  return entityInfo

# COMMAND ----------

# compute entity similarities
def cosineSim(m):
	# compute dot product
	print("[cosineSim] compute dot product")
	mdot = np.array(m.dot(m.T).todense())
	# compute inverse feature vector magnitudes
	print("[cosineSim] compute inverse feature lens")
	invSqMag = np.array(1.0/np.diag(mdot))
	# set NaN to zero
	invSqMag[np.isinf(invSqMag)] = 0
	invMag = np.sqrt(invSqMag)
	# get cosine sim by elementwise multiply by inverse magnitudes
	print("[cosineSim] scale dot product")
	#invMagMat = np.diag(invMag)
	#sim = np.dot(np.dot(invMagMat, mdot), invMagMat)
	sim = (mdot * invMag).T * invMag
	print("[cosineSim] done")
	return sim

# faster than the next one, but might result in out of mem errors
def load_entity_user_wt_fast(entityUserDF):
  _entityUserWt = {}
  entityUserWt_list = [(e[0], e[1], 1.0) for e in entityUserDF.select(entity,uID).collect()]
  for e,u,wt in entityUserWt_list:
    e_u_wt_list = _entityUserWt.get(e)
    if e_u_wt_list is None:
      _entityUserWt[e] = {u : wt}
    else:
      e_u_wt_list[u] = wt
        
  users = [u[0] for u in entityUserDF.select(uID).distinct().collect()]
  entities = list({u[0] for u in entityUserWt_list})
  return (entities, users, _entityUserWt)

def load_entity_user_wt(entityUserDF):
  _entities = [e[0] for e in entityUserDF.select(entity).distinct().collect()]
  _entityUserWt = {}
  for ent in _entities:
    userlist = [(e[0], e[1], 1.0) for e in entityUserDF.where(entityUserDF[entity] == ent).select(entity,uID).collect()]
    for e,u,wt in userlist:
      e_u_wt_list = _entityUserWt.get(e)
      if e_u_wt_list is None:
        _entityUserWt[e] = {u : wt}
      else:
        e_u_wt_list[u] = wt

  users = [u[0] for u in entityUserDF.select(uID).distinct().collect()]
  # entities = list({u[0] for u in entityUserWt_list})
  entities = _entities
  return (entities, users, _entityUserWt)

def compute_sim_mat(entityUserDF):
  # build a dict of {userID: integer index}
  # entities, users, entityUserWt = load_entity_user_wt(entityUserDF)
  entities, users, entityUserWt = load_entity_user_wt_fast(entityUserDF)

  nusers = len(users)
  print "nusers: %d" % nusers
  useridx = dict(izip(iter(users), iter(range(nusers))))
  nEntities = len(entities)
  print "nEntities: %d" % nEntities
  # build feature vector - each row is an entity, each column is a user
  print("[computeEntitySims] Building feature vectors %s" % str(datetime.datetime.now()))
  uservecs = []
  for idx in range(nEntities):
    eudf = entityUserWt[entities[idx]]
    # print("[computeEntitySims] Building feature vector %d for %s"%(idx, entities[idx]))
    uidx = [useridx[uid] for uid in eudf.keys()]
    rowdata = np.zeros(nusers)
    # weight each feature (user) by their number of (weighted) orders
    rowdata[uidx] = [eudf[uid] for uid in eudf.keys()]
    # rowdata[uidx] = 1      # unweighted
    uservecs.append(csr_matrix(rowdata))
  uservecs = vstack(uservecs)  
  print("[computeEntitySims] Computing cosine similarity %s"%str(datetime.datetime.now()))
  sim = cosineSim(uservecs)
  print("[computeEntitySims] Done computing cosine similarity %s"%str(datetime.datetime.now()))
  return sim

# COMMAND ----------

df = load_data(srcFilePath)
# df = load_data(samples[rtp50mb])
(orderInfoDF, entityUserDF) = build_common_tbls(df)

# COMMAND ----------

partTbls = [
  brands_info(df),
  gen_tag_info_tbl(df),
  calculate_spending_patterns(orderInfoDF),
  build_frac_growth_rate_tbl(orderInfoDF)]
#   build_age_tbl(entityUserDF),
#   build_category_data(entityUserDF, catFreqInfo),
#   build_numeric_tbl(entityUserDF)]

entityInfo = reduce(lambda df, tbl: df.join(tbl, entity, how="outer"), partTbls)
entityInfo = add_computed_cols(entityInfo)

# COMMAND ----------
print "writing entityInfo to s3: %s" % destEntityInfoPath
entityInfo.repartition(1).write.format('com.databricks.spark.csv') \
  .options(header='true', nullValue='') \
  .save('/mnt/' + AWS_BUCKET_NAME + '/' + destEntityInfoPath, mode='overwrite')
print "written entityInfo to S3."
# COMMAND ----------
# compute and write out simMatrix

sim = compute_sim_mat(orderInfoDF.groupby(entity, uID).count())
print "sim length: %d" % len(sim)

binary_dump = dumps(sim,-1)
print "writing simMat to s3 Key: %s/%s" % (AWS_BUCKET_NAME, destSimMatKey)

# Open a connection to S3 and write the contents
conn = S3Connection(ACCESS_KEY, SECRET_KEY)
bucket = conn.get_bucket(AWS_BUCKET_NAME)
k = Key(bucket)
k.key = destSimMatKey
k.set_metadata("encoder","pickle-version-2")
k.set_metadata("generated-by", "mappr-etl")
k.set_metadata("generated-by-source", srcFilePath)
k.set_contents_from_string(binary_dump)
print "written simMat to S3."
sqlContext.clearCache()
